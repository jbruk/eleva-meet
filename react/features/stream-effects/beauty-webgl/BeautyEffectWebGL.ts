import { IStore } from '../../app/types';

import { glUtils } from './glUtils';
import { fragmentShader, vertexShader } from './shaders';

export interface IBeautyEffectOptions {
    filterType: number; // 0 = none, 1 = grayscale, 2 = cloudDay, 3 = sunlight, 4 = moonlight
    intensity: number; // 0.0 to 1.0 for filter strength
}

/**
 * WebGL-based filter effect for video streams.
 * Implements various full-screen filter effects similar to Google Meet.
 * 
 * This class implements the Jitsi effect interface expected by setEffect().
 */
export class BeautyEffectWebGL {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D | null = null;
    private gl: WebGLRenderingContext | null = null;
    private program: WebGLProgram | null = null;
    private texture: WebGLTexture | null = null;
    private framebuffer: WebGLFramebuffer | null = null;
    private videoTexture: WebGLTexture | null = null;
    private stream: MediaStream | null = null;
    private usingCanvasStream: boolean = false;
    private videoElement: HTMLVideoElement | null = null;
    private animationFrameId: number | null = null;
    private videoFrameCallbackId: any = null;
    private frameIntervalId: any = null;
    private stopHooks: Array<() => void> = [];
    private watchdogId: any = null; // unused after simplifying; left for cleanup
    private options: IBeautyEffectOptions;
    private store: IStore;
    private isProcessing: boolean = false;
    private videoReady: boolean = false;
    private trackPaused: boolean = false;
    private _replaceListenerAdded = false;
    private enabled: boolean = false;
    private originalStream: MediaStream | null = null;
    private jitsiTrackRef: any = null;
    private streamWatchdogId: any = null;
    private lastRefreshAtMs: number = 0;
    private isRefreshingStream: boolean = false;
    private deferredCleanupId: any = null;

    constructor(options: IBeautyEffectOptions, store: IStore) {
        this.options = options;
        this.store = store;
        this.canvas = document.createElement('canvas');
        this.canvas.width = 1280; // Default size, will be updated
        this.canvas.height = 720;
    }

    /**
     * Checks if the effect is currently enabled.
     * Required by Jitsi effect interface.
     * 
     * @returns True if the effect is enabled
     */
    isEnabled(): boolean {
        return this.enabled;
    }

    setJitsiTrack(track: any) {
        this.jitsiTrackRef = track;
        if (track && !this._replaceListenerAdded) {
            this._replaceListenerAdded = true;
            
            // Handle track replacement during WebRTC renegotiation
            track.addListener && track.addListener('REPLACE_TRACK', async ({ sender }: any) => {
                console.log('BeautyEffect: REPLACE_TRACK event triggered');
                await this.refreshCanvasStream(sender);
            });
            
            // Listen for peer connection state changes that can affect streams
            if (typeof window !== 'undefined' && track.conference) {
                const conference = track.conference;
                
                const onUserJoined = () => {
                    console.log('BeautyEffect: User joined, scheduling stream refresh');
                    setTimeout(() => {
                        if (this.enabled) {
                            this.refreshCanvasStream();
                        }
                    }, 2000); // Delay to let WebRTC renegotiation complete
                };
                
                const onUserLeft = () => {
                    console.log('BeautyEffect: User left, scheduling stream refresh');
                    setTimeout(() => {
                        if (this.enabled) {
                            this.refreshCanvasStream();
                        }
                    }, 1000);
                };
                
                // Use proper Jitsi event names
                conference.on && conference.on('user.joined', onUserJoined);
                conference.on && conference.on('user.left', onUserLeft);
                
                this.stopHooks.push(() => {
                    if (conference.off) {
                        conference.off('user.joined', onUserJoined);
                        conference.off('user.left', onUserLeft);
                    }
                });
            }
        }
    }

    /**
     * Refreshes the canvas stream and updates all references
     */
    private async refreshCanvasStream(sender?: RTCRtpSender): Promise<void> {
        if (!this.canvas || !this.enabled) {
            console.warn('BeautyEffect: Cannot refresh - canvas or effect not available');
            return;
        }
        // Debounce refreshes to avoid thrashing and context churn
        const now = Date.now();
        if (this.isRefreshingStream || (now - this.lastRefreshAtMs) < 1500) {
            return;
        }
        this.isRefreshingStream = true;
        try {
            console.log('BeautyEffect: Refreshing canvas stream...');
            
            // Ensure WebGL is properly initialized before creating new stream
            if (!this.gl || this.gl.isContextLost()) {
                console.log('BeautyEffect: WebGL context lost, re-initializing...');
                this.safeInitWebGL();
                // Give WebGL a moment to initialize
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // Stop the current stream tracks to clean up
            if (this.stream) {
                this.stream.getTracks().forEach(track => {
                    try {
                        if (track.readyState !== 'ended') {
                            track.stop();
                        }
                    } catch (_) {}
                });
            }
            
            // Wait a brief moment for cleanup
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Create a fresh canvas stream
            const fps = this.originalStream?.getVideoTracks()[0]?.getSettings()?.frameRate || 30;
            const newStream = this.canvas.captureStream(typeof fps === 'number' ? fps : 30) as MediaStream;
            
            // Validate the new stream
            if (!newStream || !newStream.getVideoTracks || newStream.getVideoTracks().length === 0) {
                console.warn('BeautyEffect: Failed to create valid canvas stream, retrying...');
                // Try once more after a delay
                await new Promise(resolve => setTimeout(resolve, 200));
                const retryStream = this.canvas.captureStream(30) as MediaStream;
                if (!retryStream || retryStream.getVideoTracks().length === 0) {
                    console.error('BeautyEffect: Canvas stream creation failed permanently');
                    return;
                }
                this.stream = retryStream;
            } else {
                this.stream = newStream;
            }
            
            const newTrack = this.stream.getVideoTracks()[0];
            console.log('BeautyEffect: Created new canvas track:', {
                id: newTrack.id,
                readyState: newTrack.readyState,
                enabled: newTrack.enabled,
                muted: newTrack.muted
            });
            
            // Set content hint for better encoding
            try {
                if ('contentHint' in newTrack) {
                    (newTrack as any).contentHint = 'motion';
                }
            } catch (_) {}
            
            // Replace the track in the WebRTC sender if provided
            if (sender) {
                try {
                    await sender.replaceTrack(newTrack);
                    console.log('BeautyEffect: Successfully replaced WebRTC track');
                } catch (error) {
                    console.error('BeautyEffect: Failed to replace WebRTC track:', error);
                    // If sender replacement fails, try to get updated sender from Jitsi track
                    if (this.jitsiTrackRef) {
                        try {
                            await this.jitsiTrackRef.setEffect(this);
                            console.log('BeautyEffect: Re-applied effect through Jitsi track');
                        } catch (jitsiError) {
                            console.error('BeautyEffect: Failed to re-apply through Jitsi:', jitsiError);
                        }
                    }
                }
            }
            
        } catch (error) {
            console.error('BeautyEffect: Error refreshing canvas stream:', error);
        } finally {
            this.lastRefreshAtMs = Date.now();
            this.isRefreshingStream = false;
        }
    }
    
    /**
     * Schedules a watchdog to detect and fix frozen canvas streams
     */
    private scheduleStreamWatchdog(): void {
        // Clear any existing watchdog
        if (this.streamWatchdogId) {
            clearInterval(this.streamWatchdogId);
        }
        
        let lastFrameTime = 0;
        let stuckFrameCount = 0;
        
        this.streamWatchdogId = setInterval(() => {
            if (!this.canvas || !this.enabled || !this.stream) return;
            
            // Get current frame timestamp from canvas
            const currentTime = performance.now();
            
            // Check if video element is playing and has current data
            if (this.videoElement
                && this.videoElement.readyState >= 2
                && !this.videoElement.paused
                && !this.videoElement.ended) {
                
                // Check if the canvas stream track is still active
                const track = this.stream.getVideoTracks()[0];
                if (track && track.readyState === 'ended') {
                    console.warn('BeautyEffect: Canvas track ended, forcing refresh');
                    this.refreshCanvasStream();
                    stuckFrameCount = 0;
                    return;
                }
                
                // If we haven't seen frame changes in a while, refresh
                if (currentTime - lastFrameTime > 8000) { // 8 seconds
                    stuckFrameCount++;
                    console.warn('BeautyEffect: Detected potential stream freeze, attempt:', stuckFrameCount);
                    
                    if (stuckFrameCount >= 2) {
                        console.log('BeautyEffect: Stream appears frozen, forcing refresh');
                        this.refreshCanvasStream();
                        stuckFrameCount = 0;
                    }
                } else {
                    stuckFrameCount = 0;
                }
                
                lastFrameTime = currentTime;
            }
        }, 4000); // Check every 4 seconds
        
        this.stopHooks.push(() => {
            if (this.streamWatchdogId) {
                clearInterval(this.streamWatchdogId);
                this.streamWatchdogId = null;
            }
        });
    }

    /**
     * Legacy async variant kept for external tests.
     */
    async applyEffect(stream: MediaStream): Promise<MediaStream> {
        return await this.startEffect(stream);
    }

    /**
     * Entry point expected by lib-jitsi-meet. Returns the processed MediaStream.
     */
    startEffect(stream: MediaStream): MediaStream {
        try {
            // If already running, avoid re-initialization and just return current processed stream
            if (this.enabled && this.stream) {
                return this.stream;
            }
            // Cancel any deferred cleanup from a recent stop to avoid tearing down resources mid-switch
            if (this.deferredCleanupId) {
                try { clearTimeout(this.deferredCleanupId); } catch (_) {}
                this.deferredCleanupId = null;
            }
            console.log('BeautyEffectWebGL: Starting effect with filter type:', this.options.filterType);

            this.originalStream = stream;

            // Prepare video element
            this.videoElement = document.createElement('video');
            this.videoElement.srcObject = stream;
            this.videoElement.autoplay = true;
            this.videoElement.muted = true;
            this.videoElement.playsInline = true;
            // Keep it alive in DOM to avoid platform throttling
            this.videoElement.style.position = 'fixed';
            this.videoElement.style.left = '-10000px';
            this.videoElement.style.top = '-10000px';
            this.videoElement.style.width = '1px';
            this.videoElement.style.height = '1px';
            this.videoElement.style.opacity = '0';
            document.body.appendChild(this.videoElement);

            // Canvas dimension fallback; will be updated onloadedmetadata later.
            this.canvas.width = 640;
            this.canvas.height = 480;
            // Keep canvas in DOM so captureStream stays active on all engines
            this.canvas.style.position = 'fixed';
            this.canvas.style.left = '-10000px';
            this.canvas.style.top = '-10000px';
            this.canvas.style.width = '1px';
            this.canvas.style.height = '1px';
            this.canvas.style.opacity = '0';
            document.body.appendChild(this.canvas);

            // Update size as soon as metadata is ready (no re-init to avoid extra contexts)
            this.videoElement.addEventListener('loadedmetadata', () => {
                if (this.videoElement) {
                    this.canvas.width = this.videoElement.videoWidth || this.canvas.width;
                    this.canvas.height = this.videoElement.videoHeight || this.canvas.height;
                }
            });

            // Mark ready when we can play and start rendering on first 'playing'
            const onCanPlay = () => { this.videoReady = true; };
            const onPlaying = () => {
                if (!this.isProcessing) {
                    this.startRendering();
                }
            };
            this.videoElement.addEventListener('canplay', onCanPlay);
            this.videoElement.addEventListener('playing', onPlaying);

            // Initialize WebGL synchronously with better error handling
            this.safeInitWebGL();
            
            // Handle context loss. Prevent default to allow restoration and schedule a soft reinit.
            this.canvas.addEventListener('webglcontextlost', (e: any) => {
                console.warn('WebGL context lost');
                try { e.preventDefault?.(); } catch (_){ }
                this.videoReady = false;
                // Don't reinitialize immediately here to avoid thrashing while switching filters.
                // The restored event will handle reinit.
            }, { passive: true } as any);
            this.canvas.addEventListener('webglcontextrestored', () => {
                console.log('WebGL context restored, re-initializing');
                this.safeInitWebGL();
            }, { passive: true } as any);

            // Ensure playback starts (muted + playsInline should allow autoplay)
            this.videoElement.play().catch(() => {
                // Ignore; 'playing' event will still fire once the browser allows it
            });

            // Listen for camera track mute/unmute so we can pause rendering during renegotiations
            const camTrack = stream.getVideoTracks()[0];
            if (camTrack) {
                const onMute = () => { this.trackPaused = true; };
                const onUnmute = () => { this.trackPaused = false; };
                camTrack.addEventListener('mute', onMute);
                camTrack.addEventListener('unmute', onUnmute);
                // Clean up listeners on stop
                this.stopHooks.push(() => {
                    camTrack.removeEventListener('mute', onMute);
                    camTrack.removeEventListener('unmute', onUnmute);
                });
            }

            if (this.jitsiTrackRef) {
                this.setJitsiTrack(this.jitsiTrackRef);
            }

            const fps = stream.getVideoTracks()[0]?.getSettings()?.frameRate || 30;
            this.enabled = true;
            
            // Create initial canvas stream
            const captured = this.canvas.captureStream(typeof fps === 'number' ? fps : 30) as any;

            // Some browsers may return a non-MediaStream-like object early; fallback to original stream.
            if (!captured || typeof captured.getTracks !== 'function') {
                console.warn('Canvas captureStream failed, using original stream');
                this.stream = this.originalStream!;
                this.usingCanvasStream = false;
            } else {
                this.stream = captured as MediaStream;
                this.usingCanvasStream = true;
                try {
                    const t = this.stream.getVideoTracks?.()[0];
                    if (t && 'contentHint' in t) { (t as any).contentHint = 'motion'; }
                } catch (_) {}
            }

            // Start the stream watchdog to detect freezes
            this.scheduleStreamWatchdog();

            console.log('BeautyEffectWebGL: Effect started successfully');
            return this.stream;
        } catch (e) {
            console.error('BeautyEffectWebGL: startEffect failed:', e);
            // Return original stream if effect fails to prevent black screen
            return stream;
        }
    }

    /**
     * Safe WebGL initialization that handles errors gracefully
     */
    private async safeInitWebGL(retries = 3): Promise<void> {
        for (let i = 0; i < retries; i++) {
            try {
                await this.initWebGL();
                return;
            } catch (error: any) {
                if (typeof error?.message === 'string' && error.message.includes('context is lost')) {
                    console.warn(`WebGL context lost on init (attempt ${i + 1}/${retries}), retrying...`);
                    // Give the GPU a bit more time before retrying.
                    await new Promise(r => setTimeout(r, 300));
                    continue;
                }
                console.error('WebGL initialization failed, effect will not work:', error);
                return;
            }
        }
        console.error('WebGL initialization failed after retries, giving up.');
    }

    /**
     * Stop rendering and cleanup – synchronous as expected by lib-jitsi-meet.
     */
    stopEffect(): void {
        try {
            // Mark as disabled and stop rendering immediately to stop uploading frames.
            this.enabled = false;
            this.videoReady = false;
            this.stopRendering();

            // Defer teardown slightly so Jitsi can replace the sender track with the original
            // before we end the canvas track and destroy GL resources.
            this.deferredCleanupId = setTimeout(() => {
                // Clean up watchdog
                if (this.streamWatchdogId) {
                    try { clearInterval(this.streamWatchdogId); } catch (_) {}
                    this.streamWatchdogId = null;
                }

                // Remove listeners
                try { this.stopHooks?.forEach(h => { try { h(); } catch(_){} }); } catch (_) {}
                this.stopHooks = [];

                if (this.videoElement) {
                    try { (this.videoElement as any).srcObject = null; } catch (_) {}
                    try { this.videoElement.remove(); } catch (_) {}
                    this.videoElement = null;
                }

                // Stop only the synthetic canvas tracks; never stop the original camera tracks.
                if (this.stream && this.usingCanvasStream) {
                    try { this.stream.getTracks().forEach(t => t.stop()); } catch (_) {}
                }

                // Release GL context then cleanup
                if (this.gl) {
                    try {
                        const loseContext = (this.gl as any).getExtension && (this.gl as any).getExtension('WEBGL_lose_context');
                        if (loseContext && typeof loseContext.loseContext === 'function') {
                            loseContext.loseContext();
                        }
                    } catch (_) {}
                }
                this.cleanupWebGL();

                try { this.canvas.remove(); } catch (_) {}

                this.gl = null;
                this.stream = null;
                this.usingCanvasStream = false;

                this.deferredCleanupId = null;
            }, 300);
        } catch (e) {
            console.error('BeautyEffectWebGL: stopEffect failed:', e);
        }
    }

    /**
     * Initializes the WebGL context and shaders.
     *
     * @returns Promise that resolves when WebGL is initialized
     */
    private async initWebGL(): Promise<void> {
        try {
            // Clean up existing WebGL resources first
            this.cleanupWebGL();

            // Get WebGL context with proper error checking
            this.gl = (this.canvas.getContext('webgl', {
                preserveDrawingBuffer: false,
                powerPreference: 'high-performance',
                antialias: false,
                alpha: false
            } as any) || this.canvas.getContext('experimental-webgl', {
                preserveDrawingBuffer: false,
                powerPreference: 'high-performance',
                antialias: false,
                alpha: false
            } as any)) as any;
            
            if (!this.gl) {
                throw new Error('WebGL not supported');
            }

            // Check for context loss
            if (this.gl.isContextLost()) {
                throw new Error('WebGL context is lost');
            }

            // Ensure uploaded video frames are not upside-down
            this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, true);

            // Create and compile shaders with better error handling
            let vertexShaderObj: WebGLShader;
            let fragmentShaderObj: WebGLShader;
            
            try {
                vertexShaderObj = glUtils.createShader(this.gl, this.gl.VERTEX_SHADER, vertexShader);
            } catch (error) {
                console.error('Vertex shader compilation failed:', error);
                throw new Error(`Vertex shader error: ${error}`);
            }
            
            try {
                fragmentShaderObj = glUtils.createShader(this.gl, this.gl.FRAGMENT_SHADER, fragmentShader);
            } catch (error) {
                console.error('Fragment shader compilation failed:', error);
                this.gl.deleteShader(vertexShaderObj);
                throw new Error(`Fragment shader error: ${error}`);
            }
            
            // Create program and link shaders
            try {
            this.program = glUtils.createProgram(this.gl, vertexShaderObj, fragmentShaderObj);
            } catch (error) {
                this.gl.deleteShader(vertexShaderObj);
                this.gl.deleteShader(fragmentShaderObj);
                throw new Error(`Program linking error: ${error}`);
            }

            // Clean up shader objects as they're no longer needed
            this.gl.deleteShader(vertexShaderObj);
            this.gl.deleteShader(fragmentShaderObj);

            // Set up vertex attributes
            const positionLocation = this.gl.getAttribLocation(this.program, 'a_position');
            const texCoordLocation = this.gl.getAttribLocation(this.program, 'a_texCoord');
            
            if (positionLocation === -1 || texCoordLocation === -1) {
                throw new Error('Failed to get shader attribute locations');
            }
            
            // Create buffers
            const positionBuffer = this.gl.createBuffer();
            const texCoordBuffer = this.gl.createBuffer();

            if (!positionBuffer || !texCoordBuffer) {
                throw new Error('Failed to create WebGL buffers');
            }

            // Set up position buffer
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
            this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
                -1, -1,
                 1, -1,
                -1, 1,
                1, 1,
            ]), this.gl.STATIC_DRAW);
            this.gl.enableVertexAttribArray(positionLocation);
            this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);

            // Set up texture coordinate buffer
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, texCoordBuffer);
            this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([
                0, 0,
                1, 0,
                0, 1,
                1, 1,
            ]), this.gl.STATIC_DRAW);
            this.gl.enableVertexAttribArray(texCoordLocation);
            this.gl.vertexAttribPointer(texCoordLocation, 2, this.gl.FLOAT, false, 0, 0);

            // Create texture for video
            this.videoTexture = this.gl.createTexture();
            if (!this.videoTexture) {
                throw new Error('Failed to create video texture');
            }
            
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.videoTexture);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);

            // No off-screen framebuffer needed; render directly to default framebuffer

            console.log('BeautyEffectWebGL: WebGL initialization completed successfully');
        } catch (error) {
            console.error('BeautyEffectWebGL: WebGL initialization failed:', error);
            this.cleanupWebGL();
            throw error;
        }
    }

    /**
     * Clean up WebGL resources
     */
    private cleanupWebGL(): void {
        if (this.gl) {
            try {
                if (this.program) {
                    this.gl.deleteProgram(this.program);
                    this.program = null;
                }
                if (this.videoTexture) {
                    this.gl.deleteTexture(this.videoTexture);
                    this.videoTexture = null;
                }
                // Framebuffer/texture no longer used
            } catch (error) {
                console.warn('Error cleaning up WebGL resources:', error);
            }
        }
    }

    /**
     * Updates the filter effect parameters based on the current options.
     */
    private updateUniforms(): void {
        if (!this.gl || !this.program) return;

        const gl = this.gl;
        const program = this.program;

        // Set resolution uniform
        const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
        gl.uniform2f(resolutionLocation, this.canvas.width, this.canvas.height);

        // Set filter type uniform
        const filterTypeLocation = gl.getUniformLocation(program, 'u_filterType');
        gl.uniform1f(filterTypeLocation, this.options.filterType);

        // Set intensity uniform
        const intensityLocation = gl.getUniformLocation(program, 'u_intensity');
        gl.uniform1f(intensityLocation, this.options.intensity);
    }

        /**
     * Renders a frame with the filter effect applied.
     */
    private renderFrame(): void {
        if (!this.videoReady || this.trackPaused) return;
        
        // Check if WebGL context is available and valid
        if (!this.gl || this.gl.isContextLost() || !this.program || !this.videoElement || !this.videoTexture) {
            // Try to reinitialize WebGL if context was lost
            if (!this.gl || this.gl.isContextLost()) {
                console.warn('WebGL context lost during rendering, attempting to restore...');
                this.safeInitWebGL();
            }
            return;
        }

        try {
            const gl = this.gl;

            // Render directly to the canvas default framebuffer
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, this.canvas.width, this.canvas.height);

            // Clear the canvas
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);

            // Use the shader program
            gl.useProgram(this.program);

            // Update uniforms
            this.updateUniforms();

            // Bind video texture only when there's current data available
            if (this.videoElement.readyState >= 2) {
                gl.activeTexture(gl.TEXTURE0);
                gl.bindTexture(gl.TEXTURE_2D, this.videoTexture);
                
                try {
                    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.videoElement);
                } catch (error) {
                    console.warn('Error updating video texture:', error);
            return;
        }

                // Set texture uniform
                const textureLocation = gl.getUniformLocation(this.program, 'u_texture');
                if (textureLocation !== null) {
                    gl.uniform1i(textureLocation, 0);
                }

                // Draw the quad
                gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            }

            // Check for GL errors
            const error = gl.getError();
            if (error !== gl.NO_ERROR) {
                console.warn('WebGL rendering error:', error);
            }

        } catch (error) {
            console.error('Error during frame rendering:', error);
            // Don't try to reinitialize too aggressively - just skip this frame
        }
    }

    /**
     * Starts the rendering loop.
     */
    private startRendering(): void {
        if (this.isProcessing) return;

        this.isProcessing = true;
        // Prefer steady rAF driven loop with simple FPS throttle to avoid stalls
        let last = 0;
        const targetDelta = 1000 / 30;
        const renderLoop = (ts?: number) => {
            if (!this.isProcessing) return;
            if (!ts) ts = performance.now();
            if (ts - last >= targetDelta) {
                this.renderFrame();
                last = ts;
            }
            this.animationFrameId = requestAnimationFrame(renderLoop as any);
        };
        this.animationFrameId = requestAnimationFrame(renderLoop as any);

        // Fallback heartbeat to ensure progress even if rAF throttles
        this.frameIntervalId = setInterval(() => {
            if (this.isProcessing) {
            this.renderFrame();
            }
        }, 500);
    }

    /**
     * Stops the rendering loop.
     */
    private stopRendering(): void {
        this.isProcessing = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        const v: any = this.videoElement as any;
        if (v && typeof v.cancelVideoFrameCallback === 'function' && this.videoFrameCallbackId) {
            try { v.cancelVideoFrameCallback(this.videoFrameCallbackId); } catch (_) {}
            this.videoFrameCallbackId = null;
        }
        if (this.frameIntervalId) {
            try { clearInterval(this.frameIntervalId); } catch (_) {}
            this.frameIntervalId = null;
        }
        if (this.watchdogId) { try { clearInterval(this.watchdogId); } catch (_) {} this.watchdogId = null; }
    }

    /**
     * Updates the filter options.
     * 
     * @param {IBeautyEffectOptions} options - New filter options
     * @returns {void}
     */
    updateOptions(options: IBeautyEffectOptions): void {
        this.options = options;
    }

    /**
     * Manually refresh the canvas stream to fix frozen video issues.
     * 
     * @returns {Promise<void>}
     */
    async forceRefreshStream(): Promise<void> {
        await this.refreshCanvasStream();
    }

    // Removed PC-scanning watchdog to avoid engine-specific errors and context churn.

    // Backwards-compatible alias
    stop(): void {
        this.stopEffect();
    }

    /**
     * Gets the current filter type.
     * 
     * @returns Current filter type
     */
    getFilterType(): number {
        return this.options.filterType;
    }

    /**
     * Gets the current filter intensity.
     * 
     * @returns Current filter intensity
     */
    getIntensity(): number {
        return this.options.intensity;
    }

    /**
     * Checks if WebGL is supported.
     * 
     * @returns True if WebGL is supported
     */
    static isSupported(): boolean {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        return gl !== null;
    }
}
