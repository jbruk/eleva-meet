/**
 * Vertex shader shared by all passes.
 */
export const vertexShader = `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;

    varying vec2 v_texCoord;

    void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
    }
`;

/**
 * Basic passthrough fragment shader.
 */
export const passthroughFragment = `
    precision mediump float;

    varying vec2 v_texCoord;
    uniform sampler2D u_texture;

    void main() {
        gl_FragColor = texture2D(u_texture, v_texCoord);
    }
`;

/**
 * Separable Gaussian blur fragment shader.
 * Use with two passes: set u_direction to (1.0 / width, 0.0) then (0.0, 1.0 / height).
 */
export const gaussianBlurFragment = `
    precision mediump float;

    varying vec2 v_texCoord;
    uniform sampler2D u_texture;
    uniform vec2 u_direction; // (texelStepX, texelStepY)

    void main() {
        // 9-tap Gaussian weights (approx sigma ~ 2.0)
        float w0 = 0.227027;
        float w1 = 0.1945946;
        float w2 = 0.1216216;
        float w3 = 0.054054;
        float w4 = 0.016216;

        vec4 color = texture2D(u_texture, v_texCoord) * w0;
        color += texture2D(u_texture, v_texCoord + 1.0 * u_direction) * w1;
        color += texture2D(u_texture, v_texCoord - 1.0 * u_direction) * w1;
        color += texture2D(u_texture, v_texCoord + 2.0 * u_direction) * w2;
        color += texture2D(u_texture, v_texCoord - 2.0 * u_direction) * w2;
        color += texture2D(u_texture, v_texCoord + 3.0 * u_direction) * w3;
        color += texture2D(u_texture, v_texCoord - 3.0 * u_direction) * w3;
        color += texture2D(u_texture, v_texCoord + 4.0 * u_direction) * w4;
        color += texture2D(u_texture, v_texCoord - 4.0 * u_direction) * w4;

        gl_FragColor = color;
    }
`;

/**
 * Composite shader: mix original and processed textures using a mask.
 * Also applies optional brightness/gamma lift inside the masked region only.
 */
export const compositeFragment = `
    precision mediump float;

    varying vec2 v_texCoord;
    uniform sampler2D u_original;
    uniform sampler2D u_processed;
    uniform sampler2D u_mask; // single-channel mask in RGB
    uniform float u_intensity; // 0..1 smoothing amount
    uniform float u_gamma;     // 1.0 = no change, <1.0 brighter
    uniform float u_contrast;  // 1.0 = no change
    uniform float u_exposure;  // 1.0 = no change, >1.0 brighter
    uniform float u_saturation; // 1.0 = no change
    uniform float u_tintStrength; // 0..1 warm tint inside mask
    uniform float u_filterType; // 0 = none, 1 = grayscale, 2 = cloudDay, 3 = sunlight, 4 = moonlight
    uniform float u_filterStrength; // 0..1

    vec3 adjustGammaContrast(vec3 c, float gamma, float contrast) {
        // gamma
        vec3 g = pow(c, vec3(gamma));
        // contrast around 0.5
        return (g - 0.5) * contrast + 0.5;
    }

    vec3 adjustSaturation(vec3 c, float sat) {
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        return mix(vec3(l), c, sat);
    }

    float rgbToGrayscale(vec3 color) {
        return dot(color, vec3(0.299, 0.587, 0.114));
    }

    vec3 applyGrayscale(vec3 color, float intensity) {
        float gray = rgbToGrayscale(color);
        return mix(color, vec3(gray), intensity);
    }

    vec3 applyCloudDay(vec3 color, float intensity) {
        vec3 warmColor = color * vec3(1.1, 1.05, 0.95);
        vec3 adjusted = pow(warmColor, vec3(0.95));
        float gray = rgbToGrayscale(warmColor);
        vec3 desaturated = mix(warmColor, vec3(gray), 0.1);
        return mix(color, desaturated, intensity);
    }

    vec3 applySunlight(vec3 color, float intensity) {
        vec3 brightWarm = color * vec3(1.2, 1.15, 1.0);
        vec3 contrasted = pow(brightWarm, vec3(0.85));
        vec3 golden = contrasted * vec3(1.1, 1.05, 0.9);
        return mix(color, golden, intensity);
    }

    vec3 applyMoonlight(vec3 color, float intensity) {
        vec3 coolColor = color * vec3(0.9, 0.95, 1.1);
        vec3 softened = pow(coolColor, vec3(1.1));
        vec3 moonlit = softened * vec3(0.9, 0.95, 1.15);
        float gray = rgbToGrayscale(moonlit);
        vec3 dreamy = mix(moonlit, vec3(gray), 0.15);
        return mix(color, dreamy, intensity);
    }

    void main() {
        vec4 orig = texture2D(u_original, v_texCoord);
        vec4 proc = texture2D(u_processed, v_texCoord);
        float m = texture2D(u_mask, v_texCoord).r; // 0..1

        // First: smoothing blend using blurred processed image
        vec3 smoothed = mix(orig.rgb, proc.rgb, m * u_intensity);

        // Second: inside mask, apply brightness/contrast/exposure/saturation and a subtle warm tint
        vec3 lifted = adjustGammaContrast(smoothed, u_gamma, u_contrast);
        lifted *= u_exposure;
        lifted = adjustSaturation(lifted, u_saturation);

        // Warm tint similar to "touch up" look (subtle)
        vec3 warm = lifted * vec3(1.05, 1.02, 0.98);
        vec3 beautified = mix(lifted, warm, clamp(u_tintStrength, 0.0, 1.0));

        // Only apply the color adjustments within the mask
        vec3 baseColor = mix(smoothed, beautified, m);

        // Optional color filter applied full-frame on top, to match existing filters
        vec3 filtered = baseColor;
        if (u_filterStrength > 0.0 && u_filterType > 0.0) {
            if (u_filterType == 1.0) {
                filtered = applyGrayscale(baseColor, u_filterStrength);
            } else if (u_filterType == 2.0) {
                filtered = applyCloudDay(baseColor, u_filterStrength);
            } else if (u_filterType == 3.0) {
                filtered = applySunlight(baseColor, u_filterStrength);
            } else if (u_filterType == 4.0) {
                filtered = applyMoonlight(baseColor, u_filterStrength);
            }
        }

        vec3 finalColor = filtered;

        gl_FragColor = vec4(finalColor, 1.0);
    }
`;


