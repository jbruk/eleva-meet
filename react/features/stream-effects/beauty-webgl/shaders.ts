/**
 * Vertex shader for filter effects.
 * Handles basic texture mapping and position transformation.
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
 * Fragment shader for full-screen filter effects.
 * Implements various filter effects similar to Google Meet.
 */
export const fragmentShader = `
    precision mediump float;
    
    uniform sampler2D u_texture;
    uniform vec2 u_resolution;
    uniform float u_filterType; // 0 = none, 1 = grayscale, 2 = cloudDay, 3 = sunlight, 4 = moonlight
    uniform float u_intensity; // 0.0 to 1.0 for filter strength
    
    varying vec2 v_texCoord;
    
    // Convert RGB to grayscale
    float rgbToGrayscale(vec3 color) {
        return dot(color, vec3(0.299, 0.587, 0.114));
    }
    
    // Apply grayscale filter
    vec3 applyGrayscale(vec3 color, float intensity) {
        float gray = rgbToGrayscale(color);
        return mix(color, vec3(gray), intensity);
    }
    
    // Apply warm cloud day filter (slightly warm, soft contrast)
    vec3 applyCloudDay(vec3 color, float intensity) {
        // Warm temperature adjustment
        vec3 warmColor = color * vec3(1.1, 1.05, 0.95);
        
        // Soft contrast adjustment
        vec3 adjusted = pow(warmColor, vec3(0.95));
        
        // Slight desaturation
        float gray = rgbToGrayscale(warmColor);
        vec3 desaturated = mix(warmColor, vec3(gray), 0.1);
        
        return mix(color, desaturated, intensity);
    }
    
    // Apply bright sunlight filter (warm, bright, high contrast)
    vec3 applySunlight(vec3 color, float intensity) {
        // Brighten and warm the colors
        vec3 brightWarm = color * vec3(1.2, 1.15, 1.0);
        
        // Increase contrast
        vec3 contrasted = pow(brightWarm, vec3(0.85));
        
        // Add golden tint
        vec3 golden = contrasted * vec3(1.1, 1.05, 0.9);
        
        return mix(color, golden, intensity);
    }
    
    // Apply cool moonlight filter (cool, soft, dreamy)
    vec3 applyMoonlight(vec3 color, float intensity) {
        // Cool temperature adjustment
        vec3 coolColor = color * vec3(0.9, 0.95, 1.1);
        
        // Soften the image
        vec3 softened = pow(coolColor, vec3(1.1));
        
        // Add blue tint for moonlight effect
        vec3 moonlit = softened * vec3(0.9, 0.95, 1.15);
        
        // Slight desaturation for dreamy effect
        float gray = rgbToGrayscale(moonlit);
        vec3 dreamy = mix(moonlit, vec3(gray), 0.15);
        
        return mix(color, dreamy, intensity);
    }
    
    void main() {
        vec2 uv = v_texCoord;
        vec3 originalColor = texture2D(u_texture, uv).rgb;
        
        vec3 filteredColor = originalColor;
        
        // Apply filter based on type
        if (u_filterType > 0.0 && u_intensity > 0.0) {
            if (u_filterType == 1.0) {
                filteredColor = applyGrayscale(originalColor, u_intensity);
            } else if (u_filterType == 2.0) {
                filteredColor = applyCloudDay(originalColor, u_intensity);
            } else if (u_filterType == 3.0) {
                filteredColor = applySunlight(originalColor, u_intensity);
            } else if (u_filterType == 4.0) {
                filteredColor = applyMoonlight(originalColor, u_intensity);
            }
        }
        
        gl_FragColor = vec4(filteredColor, 1.0);
    }
`;
