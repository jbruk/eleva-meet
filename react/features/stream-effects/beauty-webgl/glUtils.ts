/**
 * WebGL utility functions for the beauty filter effect.
 */

/**
 * Creates and compiles a WebGL shader.
 * 
 * @param gl - WebGL context
 * @param type - Shader type (VERTEX_SHADER or FRAGMENT_SHADER)
 * @param source - GLSL source code
 * @returns Compiled shader object
 */
export function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
    const shader = gl.createShader(type);
    
    if (!shader) {
        throw new Error('Failed to create shader');
    }
    
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const error = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`Shader compilation failed: ${error}`);
    }
    
    return shader;
}

/**
 * Creates and links a WebGL program from vertex and fragment shaders.
 * 
 * @param gl - WebGL context
 * @param vertexShader - Compiled vertex shader
 * @param fragmentShader - Compiled fragment shader
 * @returns Linked program object
 */
export function createProgram(gl: WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram {
    const program = gl.createProgram();
    
    if (!program) {
        throw new Error('Failed to create program');
    }
    
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const error = gl.getProgramInfoLog(program);
        gl.deleteProgram(program);
        throw new Error(`Program linking failed: ${error}`);
    }
    
    return program;
}

/**
 * Creates a WebGL texture with specified parameters.
 * 
 * @param gl - WebGL context
 * @param width - Texture width
 * @param height - Texture height
 * @param format - Texture format (default: RGBA)
 * @param type - Texture type (default: UNSIGNED_BYTE)
 * @returns Created texture object
 */
export function createTexture(
    gl: WebGLRenderingContext,
    width: number,
    height: number,
    format: number = gl.RGBA,
    type: number = gl.UNSIGNED_BYTE
): WebGLTexture {
    const texture = gl.createTexture();
    
    if (!texture) {
        throw new Error('Failed to create texture');
    }
    
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, format, width, height, 0, format, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    
    return texture;
}

/**
 * Creates a WebGL framebuffer with a texture attachment.
 * 
 * @param gl - WebGL context
 * @param texture - Texture to attach
 * @returns Created framebuffer object
 */
export function createFramebuffer(gl: WebGLRenderingContext, texture: WebGLTexture): WebGLFramebuffer {
    const framebuffer = gl.createFramebuffer();
    
    if (!framebuffer) {
        throw new Error('Failed to create framebuffer');
    }
    
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        gl.deleteFramebuffer(framebuffer);
        throw new Error('Framebuffer is not complete');
    }
    
    return framebuffer;
}

/**
 * Checks if WebGL is supported and returns the context.
 * 
 * @param canvas - Canvas element
 * @returns WebGL context or null if not supported
 */
export function getWebGLContext(canvas: HTMLCanvasElement): WebGLRenderingContext | null {
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
    
    if (!gl) {
        console.warn('WebGL not supported');
        return null;
    }
    
    return gl;
}

/**
 * Utility object containing all WebGL helper functions.
 */
export const glUtils = {
    createShader,
    createProgram,
    createTexture,
    createFramebuffer,
    getWebGLContext
};
