import { IStore } from '../../app/types';
import { glUtils } from '../beauty-webgl/glUtils';
import { vertexShader, gaussianBlurFragment, compositeFragment, passthroughFragment } from './shaders';

type Landmark = { x: number; y: number; z?: number };

export interface ITouchUpOptions {
    brighten: number; // 0..1
    filterStrength?: number; // 0..1
    filterType?: number; // 0..4
    intensity: number; // smoothing 0..1
    smoothness: number; // reserved, mapped to downscale/blur later
}

export class TouchUpAppearanceEffect {
    private canvas: HTMLCanvasElement;
    private gl: WebGLRenderingContext | null = null;
    private video: HTMLVideoElement | null = null;
    private originalStream: MediaStream | null = null;
    private stream: MediaStream | null = null;
    private usingCanvasStream = false;
    private enabled = false;
    private isProcessing = false;
    private videoReady = false;
    private animationFrameId: number | null = null;
    private frameIntervalId: any = null;

    private options: ITouchUpOptions;
    private store?: IStore;

    // GL resources
    private programPassthrough: WebGLProgram | null = null;
    private programBlur: WebGLProgram | null = null;
    private programComposite: WebGLProgram | null = null;
    private positionBuffer: WebGLBuffer | null = null;
    private texCoordBuffer: WebGLBuffer | null = null;
    private videoTexture: WebGLTexture | null = null;
    private processedTexA: WebGLTexture | null = null;
    private processedTexB: WebGLTexture | null = null;
    private maskTexture: WebGLTexture | null = null;
    private fboA: WebGLFramebuffer | null = null;
    private fboB: WebGLFramebuffer | null = null;

    // Downscale for blur
    private downscale = 0.5;
    private downW = 0;
    private downH = 0;

    // Mask via 2D canvas
    private maskCanvas: HTMLCanvasElement;
    private maskCtx: CanvasRenderingContext2D | null = null;
    private maskTmpCanvas: HTMLCanvasElement | null = null;
    private maskTmpCtx: CanvasRenderingContext2D | null = null;
    private maskDirty = true;

    // Landmarks
    private lastLandmarks: Landmark[] | null = null;

    // FaceMesh
    private faceMesh: any = null;
    private faceLoopRunning = false;
    private lastFaceUpdateTs = 0;
    private useFallbackMask = false;

    constructor(options?: Partial<ITouchUpOptions>, store?: IStore) {
        this.options = {
            intensity: options?.intensity ?? 0.6,
            brighten: options?.brighten ?? 0.3,
            smoothness: options?.smoothness ?? 0.7,
            filterType: options?.filterType ?? 0,
            filterStrength: options?.filterStrength ?? 0
        };
        this.store = store;

        this.canvas = document.createElement('canvas');
        this.canvas.width = 640;
        this.canvas.height = 480;
        this.canvas.style.position = 'fixed';
        this.canvas.style.left = '-10000px';
        this.canvas.style.top = '-10000px';
        this.canvas.style.width = '1px';
        this.canvas.style.height = '1px';
        this.canvas.style.opacity = '0';
        document.body.appendChild(this.canvas);

        this.maskCanvas = document.createElement('canvas');
        this.maskCanvas.width = this.canvas.width;
        this.maskCanvas.height = this.canvas.height;
        this.maskCtx = this.maskCanvas.getContext('2d');
        this.maskTmpCanvas = document.createElement('canvas');
        this.maskTmpCanvas.width = this.canvas.width;
        this.maskTmpCanvas.height = this.canvas.height;
        this.maskTmpCtx = this.maskTmpCanvas.getContext('2d');
    }

    setJitsiTrack(_track: any) {}

    isEnabled() {
        return this.enabled;
    }

    updateOptions(opts: Partial<ITouchUpOptions>) {
        this.options = { ...this.options, ...opts };
    }

    stopEffect(): void {
        this.enabled = false;
        this.videoReady = false;
        this.stopRendering();

        try {
            if (this.stream && this.usingCanvasStream) {
                this.stream.getTracks().forEach(t => {
                    try { t.stop(); } catch (_) {}
                });
            }
        } catch (_) {}

        if (this.video) {
            try { (this.video as any).srcObject = null; } catch (_) {}
            try { this.video.remove(); } catch (_) {}
            this.video = null;
        }

        try { this.canvas.remove(); } catch (_) {}
        this.cleanupGL();
        this.stream = null;
        this.usingCanvasStream = false;
        this.faceLoopRunning = false;
        this.faceMesh = null;

        // Force GC-friendly release of FaceMesh instance
        try {
            if ((this as any).faceMesh && typeof (this as any).faceMesh.close === 'function') {
                (this as any).faceMesh.close();
            }
        } catch (_) {}
    }

    startEffect(stream: MediaStream): MediaStream {
        if (this.enabled && this.stream) {
            return this.stream as MediaStream;
        }

        this.originalStream = stream;

        this.video = document.createElement('video');
        this.video.autoplay = true;
        this.video.muted = true;
        this.video.playsInline = true;
        this.video.srcObject = stream;
        this.video.style.position = 'fixed';
        this.video.style.left = '-10000px';
        this.video.style.top = '-10000px';
        this.video.style.width = '1px';
        this.video.style.height = '1px';
        this.video.style.opacity = '0';
        document.body.appendChild(this.video);

        this.video.addEventListener('loadedmetadata', () => {
            if (!this.video) {
                return;
            }
            this.canvas.width = this.video.videoWidth || this.canvas.width;
            this.canvas.height = this.video.videoHeight || this.canvas.height;
            this.maskCanvas.width = this.canvas.width;
            this.maskCanvas.height = this.canvas.height;
            if (this.maskTmpCanvas) {
                this.maskTmpCanvas.width = this.canvas.width;
                this.maskTmpCanvas.height = this.canvas.height;
            }
            this.downW = Math.max(2, Math.floor(this.canvas.width * this.downscale));
            this.downH = Math.max(2, Math.floor(this.canvas.height * this.downscale));
            this.initGL();
        });

        this.video.addEventListener('canplay', () => {
            this.videoReady = true;
        });
        this.video.addEventListener('playing', () => {
            if (!this.isProcessing) {
                this.startRendering();
            }
        });

        this.video.play().catch(() => {});

        const fps = stream.getVideoTracks()[0]?.getSettings()?.frameRate || 30;
        const out = this.canvas.captureStream(typeof fps === 'number' ? fps : 30) as MediaStream;
        if (!out || !out.getTracks || out.getVideoTracks().length === 0) {
            this.stream = stream;
            this.usingCanvasStream = false;
            this.enabled = true;
            this.setupFaceMesh();
            return stream;
        }

        this.stream = out;
        this.usingCanvasStream = true;
        this.enabled = true;
        this.setupFaceMesh();

        return out;
    }

    private async setupFaceMesh() {
        if (this.faceMesh) {
            return;
        }
        try {
            let FaceMeshCtor: any = (window as any).FaceMesh;
            if (!FaceMeshCtor) {
                await new Promise<void>((resolve, reject) => {
                    const s = document.createElement('script');
                    s.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1635861595/face_mesh.js';
                    s.crossOrigin = 'anonymous';
                    s.async = true;
                    s.onload = () => resolve();
                    s.onerror = () => reject(new Error('Failed to load MediaPipe FaceMesh'));
                    document.head.appendChild(s);
                });
                FaceMeshCtor = (window as any).FaceMesh;
            }

            if (!FaceMeshCtor) {
                this.useFallbackMask = true;
                return;
            }

            const BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1635861595';
            this.faceMesh = new FaceMeshCtor({ locateFile: (file: string) => `${BASE}/${file}` });
            this.faceMesh.setOptions({
                maxNumFaces: 1,
                refineLandmarks: true,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });
            this.faceMesh.onResults((res: any) => {
                const landmarks = res.multiFaceLandmarks?.[0];
                if (landmarks && this.video) {
                    this.lastLandmarks = landmarks.map((lm: any) => ({
                        x: lm.x * this.canvas.width,
                        y: lm.y * this.canvas.height,
                        z: lm.z
                    }));
                    this.maskDirty = true;
                    this.lastFaceUpdateTs = performance.now();
                    this.useFallbackMask = false;
                }
            });

            this.startFaceLoop();
        } catch (_) {
            this.useFallbackMask = true;
        }
    }

    private startFaceLoop() {
        if (this.faceLoopRunning || !this.faceMesh || !this.video) {
            return;
        }
        this.faceLoopRunning = true;
        const run = async () => {
            if (!this.faceLoopRunning || !this.faceMesh || !this.video) {
                return;
            }
            try {
                if (this.video.readyState >= 2) {
                    await this.faceMesh.send({ image: this.video });
                }
            } catch (_) {}
            setTimeout(run, 66);
        };
        run();
    }

    private initGL() {
        this.cleanupGL();
        const gl = (this.canvas.getContext('webgl', {
            preserveDrawingBuffer: false,
            powerPreference: 'high-performance',
            antialias: false,
            alpha: false
        } as any) || this.canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
        if (!gl) {
            return;
        }
        this.gl = gl;
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

        const v = glUtils.createShader(gl, gl.VERTEX_SHADER, vertexShader);
        const fPass = glUtils.createShader(gl, gl.FRAGMENT_SHADER, passthroughFragment);
        const fBlur = glUtils.createShader(gl, gl.FRAGMENT_SHADER, gaussianBlurFragment);
        const fComp = glUtils.createShader(gl, gl.FRAGMENT_SHADER, compositeFragment);

        this.programPassthrough = glUtils.createProgram(gl, v, fPass);
        this.programBlur = glUtils.createProgram(gl, v, fBlur);
        this.programComposite = glUtils.createProgram(gl, v, fComp);

        gl.deleteShader(v);
        gl.deleteShader(fPass);
        gl.deleteShader(fBlur);
        gl.deleteShader(fComp);

        this.positionBuffer = gl.createBuffer();
        this.texCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,
             1,  1
        ]), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
            0, 0,
            1, 0,
            0, 1,
            1, 1
        ]), gl.STATIC_DRAW);

        this.videoTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.videoTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        this.processedTexA = glUtils.createTexture(gl, this.downW, this.downH);
        this.processedTexB = glUtils.createTexture(gl, this.downW, this.downH);
        this.fboA = glUtils.createFramebuffer(gl, this.processedTexA);
        this.fboB = glUtils.createFramebuffer(gl, this.processedTexB);

        this.maskTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.maskTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.canvas.width, this.canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }

    private cleanupGL() {
        if (!this.gl) {
            return;
        }
        try {
            const gl = this.gl;
            if (this.programPassthrough) { gl.deleteProgram(this.programPassthrough); }
            if (this.programBlur) { gl.deleteProgram(this.programBlur); }
            if (this.programComposite) { gl.deleteProgram(this.programComposite); }
            if (this.positionBuffer) { gl.deleteBuffer(this.positionBuffer); }
            if (this.texCoordBuffer) { gl.deleteBuffer(this.texCoordBuffer); }
            if (this.videoTexture) { gl.deleteTexture(this.videoTexture); }
            if (this.processedTexA) { gl.deleteTexture(this.processedTexA); }
            if (this.processedTexB) { gl.deleteTexture(this.processedTexB); }
            if (this.maskTexture) { gl.deleteTexture(this.maskTexture); }
            if (this.fboA) { gl.deleteFramebuffer(this.fboA); }
            if (this.fboB) { gl.deleteFramebuffer(this.fboB); }
        } catch (_) {}
        this.programPassthrough = null;
        this.programBlur = null;
        this.programComposite = null;
        this.positionBuffer = null;
        this.texCoordBuffer = null;
        this.videoTexture = null;
        this.processedTexA = null;
        this.processedTexB = null;
        this.maskTexture = null;
        this.fboA = null;
        this.fboB = null;
        this.gl = null;
    }

    private startRendering() {
        if (this.isProcessing) {
            return;
        }
        this.isProcessing = true;
        let last = 0;
        const targetDelta = 1000 / 30;
        const renderLoop = (ts?: number) => {
            if (!this.isProcessing) {
                return;
            }
            const t = ts || performance.now();
            if (t - last >= targetDelta) {
                this.renderFrame();
                last = t;
            }
            this.animationFrameId = requestAnimationFrame(renderLoop as any);
        };
        this.animationFrameId = requestAnimationFrame(renderLoop as any);
        this.frameIntervalId = setInterval(() => {
            if (this.isProcessing) { this.renderFrame(); }
        }, 500);
    }

    private stopRendering() {
        this.isProcessing = false;
        if (this.animationFrameId) { cancelAnimationFrame(this.animationFrameId); this.animationFrameId = null; }
        if (this.frameIntervalId) { try { clearInterval(this.frameIntervalId) } catch (_) {} this.frameIntervalId = null; }
    }

    private ensureMaskUpToDate() {
        if (!this.maskDirty || !this.maskCtx) { return; }
        const ctx = this.maskCtx;
        const w = this.maskCanvas.width;
        const h = this.maskCanvas.height;
        ctx.clearRect(0, 0, w, h);

        if (!this.lastLandmarks || this.lastLandmarks.length < 100) {
            if (this.useFallbackMask || performance.now() - this.lastFaceUpdateTs > 1500) {
                ctx.fillStyle = 'black';
                ctx.fillRect(0, 0, w, h);
                const tctx = this.maskTmpCtx;
                if (tctx) {
                    tctx.clearRect(0, 0, w, h);
                    tctx.fillStyle = 'black';
                    tctx.fillRect(0, 0, w, h);
                    tctx.save();
                    tctx.translate(w * 0.5, h * 0.5);
                    tctx.scale(w * 0.32, h * 0.42);
                    tctx.beginPath();
                    tctx.arc(0, 0, 1, 0, Math.PI * 2);
                    tctx.closePath();
                    tctx.restore();
                    tctx.fillStyle = 'white';
                    tctx.fill();
                    ctx.save();
                    (ctx as any).filter = 'blur(8px)';
                    ctx.drawImage(this.maskTmpCanvas as HTMLCanvasElement, 0, 0);
                    (ctx as any).filter = 'none';
                    ctx.restore();
                }
                this.maskDirty = false;
                if (this.gl && this.maskTexture) {
                    const gl = this.gl;
                    gl.bindTexture(gl.TEXTURE_2D, this.maskTexture);
                    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.maskCanvas); } catch (_) {}
                }
                return;
            }
            this.maskDirty = false; return;
        }

        const lm = this.lastLandmarks;
        const indices = this.getSkinHullIndices(lm);
        const tctx = this.maskTmpCtx;
        if (tctx) {
            tctx.clearRect(0, 0, w, h);
            tctx.fillStyle = 'black';
            tctx.fillRect(0, 0, w, h);
            tctx.fillStyle = 'white';
            if (indices.length > 0) {
                tctx.beginPath();
                const p0 = lm[indices[0]];
                tctx.moveTo(p0.x, p0.y);
                for (let i = 1; i < indices.length; i++) {
                    const p = lm[indices[i]];
                    tctx.lineTo(p.x, p.y);
                }
                tctx.closePath();
                tctx.fill();
            }
            ctx.save();
            (ctx as any).filter = 'blur(6px)';
            ctx.drawImage(this.maskTmpCanvas as HTMLCanvasElement, 0, 0);
            (ctx as any).filter = 'none';
            ctx.restore();
        }
        this.maskDirty = false;
        if (this.gl && this.maskTexture) {
            const gl = this.gl;
            gl.bindTexture(gl.TEXTURE_2D, this.maskTexture);
            try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.maskCanvas); } catch (_) {}
        }
    }

    private getSkinHullIndices(landmarks: Landmark[]): number[] {
        const ring = [
            10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
            397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
            172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
        ];
        return ring.filter(i => i >= 0 && i < landmarks.length);
    }

    private renderFrame() {
        if (!this.videoReady || !this.gl || !this.video || !this.programPassthrough || !this.programBlur || !this.programComposite || !this.videoTexture || !this.fboA || !this.fboB || !this.processedTexA || !this.processedTexB || !this.maskTexture) {
            return;
        }
        const gl = this.gl;

        if (this.video.readyState >= 2) {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.videoTexture);
            try {
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.video);
            } catch (_) { return; }
        }

        this.ensureMaskUpToDate();

        const bindQuad = (program: WebGLProgram) => {
            gl.useProgram(program);
            const posLoc = gl.getAttribLocation(program, 'a_position');
            const uvLoc = gl.getAttribLocation(program, 'a_texCoord');
            gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
            gl.enableVertexAttribArray(posLoc);
            gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
            gl.enableVertexAttribArray(uvLoc);
            gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 0, 0);
        };

        // Downscale to A
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboA);
        gl.viewport(0, 0, this.downW, this.downH);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        bindQuad(this.programPassthrough);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.videoTexture);
        const uTex0 = gl.getUniformLocation(this.programPassthrough, 'u_texture');
        if (uTex0) { gl.uniform1i(uTex0, 0); }
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        // Blur H: A -> B
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboB);
        gl.viewport(0, 0, this.downW, this.downH);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        bindQuad(this.programBlur);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.processedTexA);
        const dirH = gl.getUniformLocation(this.programBlur, 'u_direction');
        if (dirH) { gl.uniform2f(dirH, 1.0 / this.downW, 0.0); }
        const uTex1 = gl.getUniformLocation(this.programBlur, 'u_texture');
        if (uTex1) { gl.uniform1i(uTex1, 0); }
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        // Blur V: B -> A
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fboA);
        gl.viewport(0, 0, this.downW, this.downH);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        bindQuad(this.programBlur);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.processedTexB);
        const dirV = gl.getUniformLocation(this.programBlur, 'u_direction');
        if (dirV) { gl.uniform2f(dirV, 0.0, 1.0 / this.downH); }
        const uTex2 = gl.getUniformLocation(this.programBlur, 'u_texture');
        if (uTex2) { gl.uniform1i(uTex2, 0); }
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        // Composite
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        bindQuad(this.programComposite);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.videoTexture);
        const uOrig = gl.getUniformLocation(this.programComposite, 'u_original');
        if (uOrig) { gl.uniform1i(uOrig, 0); }
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.processedTexA);
        const uProc = gl.getUniformLocation(this.programComposite, 'u_processed');
        if (uProc) { gl.uniform1i(uProc, 1); }
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this.maskTexture);
        const uMask = gl.getUniformLocation(this.programComposite, 'u_mask');
        if (uMask) { gl.uniform1i(uMask, 2); }

        const intensity = Math.max(0, Math.min(1, this.options.intensity));
        const brighten = Math.max(0, Math.min(1, this.options.brighten));
        const gamma = 1.0 - 0.1 * brighten;
        const contrast = 1.0 + 0.08 * brighten;
        const exposure = 1.0 + 0.06 * brighten;
        const saturation = 1.0 + 0.1 * brighten;
        const tintStrength = 0.25 * brighten;

        const uInt = gl.getUniformLocation(this.programComposite, 'u_intensity');
        const uGam = gl.getUniformLocation(this.programComposite, 'u_gamma');
        const uCon = gl.getUniformLocation(this.programComposite, 'u_contrast');
        const uExp = gl.getUniformLocation(this.programComposite, 'u_exposure');
        const uSat = gl.getUniformLocation(this.programComposite, 'u_saturation');
        const uTint = gl.getUniformLocation(this.programComposite, 'u_tintStrength');
        if (uInt) gl.uniform1f(uInt, intensity);
        if (uGam) gl.uniform1f(uGam, gamma);
        if (uCon) gl.uniform1f(uCon, contrast);
        if (uExp) gl.uniform1f(uExp, exposure);
        if (uSat) gl.uniform1f(uSat, saturation);
        if (uTint) gl.uniform1f(uTint, tintStrength);

        const filterType = Math.max(0, Math.min(4, this.options.filterType || 0));
        const filterStrength = Math.max(0, Math.min(1, this.options.filterStrength || 0));
        const uFT = gl.getUniformLocation(this.programComposite, 'u_filterType');
        const uFS = gl.getUniformLocation(this.programComposite, 'u_filterStrength');
        if (uFT) gl.uniform1f(uFT, filterType);
        if (uFS) gl.uniform1f(uFS, filterStrength);

        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
}


