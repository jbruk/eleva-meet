// Beauty Effect Debug Script
// Run this in the browser console when Jitsi Meet is loaded

console.log('🔍 Beauty Effect Debug Script Loaded');

// Check if beauty effect is available
function checkBeautyEffect() {
    console.log('=== Beauty Effect Status Check ===');
    
    // Check WebGL support
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    console.log('✅ WebGL Support:', gl ? 'Available' : 'Not Available');
    
    // Check if beauty effect files are loaded
    console.log('🔍 Checking beauty effect components...');
    
    // Try to access beauty effect components
    try {
        // Check if the beauty button exists in the DOM
        const beautyButton = document.querySelector('[data-testid="beauty-button"], .beauty-button, [title*="beauty"], [aria-label*="beauty"]');
        console.log('🎨 Beauty Button Found:', beautyButton ? 'Yes' : 'No');
        
        if (beautyButton) {
            console.log('📍 Beauty Button Element:', beautyButton);
            console.log('📍 Beauty Button Classes:', beautyButton.className);
            console.log('📍 Beauty Button Attributes:', beautyButton.attributes);
        }
        
        // Check for beauty-related CSS classes
        const beautyElements = document.querySelectorAll('.beauty, [class*="beauty"]');
        console.log('🎨 Beauty-related Elements Found:', beautyElements.length);
        
        // Check Redux state (if available)
        if (window.APP && window.APP.store) {
            const state = window.APP.store.getState();
            console.log('📊 Redux State Beauty Feature:', state['features/beauty']);
        } else {
            console.log('📊 Redux Store:', 'Not accessible');
        }
        
        // Check for beauty effect in global scope
        if (window.BeautyEffectWebGL) {
            console.log('✅ BeautyEffectWebGL Class:', 'Available');
        } else {
            console.log('❌ BeautyEffectWebGL Class:', 'Not found');
        }
        
        // Check for beauty-related functions
        if (window.toggleBeautyEffect) {
            console.log('✅ toggleBeautyEffect Function:', 'Available');
        } else {
            console.log('❌ toggleBeautyEffect Function:', 'Not found');
        }
        
    } catch (error) {
        console.error('❌ Error checking beauty effect:', error);
    }
}

// Test beauty effect application
function testBeautyEffect() {
    console.log('=== Testing Beauty Effect Application ===');
    
    try {
        // Get local video track
        if (window.APP && window.APP.store) {
            const state = window.APP.store.getState();
            const tracks = state['features/base/tracks'];
            const localVideoTrack = tracks.find(track => track.local && track.mediaType === 'video');
            
            if (localVideoTrack) {
                console.log('📹 Local Video Track Found:', localVideoTrack);
                console.log('📹 Track ID:', localVideoTrack.jitsiTrack?.getId());
                console.log('📹 Track Stream:', localVideoTrack.jitsiTrack?.getOriginalStream());
                
                // Try to apply beauty effect
                if (window.toggleBeautyEffect) {
                    console.log('🎨 Attempting to apply beauty effect...');
                    window.toggleBeautyEffect({ level: 2 }, window.APP.store);
                } else {
                    console.log('❌ toggleBeautyEffect function not available');
                }
            } else {
                console.log('❌ No local video track found');
            }
        } else {
            console.log('❌ APP store not accessible');
        }
    } catch (error) {
        console.error('❌ Error testing beauty effect:', error);
    }
}

// Manual beauty effect control
function setBeautyLevel(level) {
    console.log(`🎨 Setting beauty level to: ${level}`);
    
    try {
        if (window.APP && window.APP.store) {
            // Dispatch beauty level change
            window.APP.store.dispatch({
                type: 'SET_BEAUTY_LEVEL',
                level: level
            });
            
            console.log(`✅ Beauty level set to ${level}`);
        } else {
            console.log('❌ APP store not accessible');
        }
    } catch (error) {
        console.error('❌ Error setting beauty level:', error);
    }
}

// Check for beauty effect in loaded modules
function checkLoadedModules() {
    console.log('=== Checking Loaded Modules ===');
    
    // Check if beauty effect files are in the bundle
    const scripts = document.querySelectorAll('script[src]');
    let beautyScripts = [];
    
    scripts.forEach(script => {
        if (script.src.includes('beauty') || script.src.includes('BeautyEffect')) {
            beautyScripts.push(script.src);
        }
    });
    
    console.log('📦 Beauty-related Scripts:', beautyScripts);
    
    // Check for beauty effect in webpack modules (if available)
    if (window.webpackChunkjitsi_meet) {
        console.log('📦 Webpack chunks found');
        // You can inspect webpackChunkjitsi_meet to see loaded modules
    }
}

// Auto-run checks
console.log('🚀 Running beauty effect checks...');
checkBeautyEffect();
checkLoadedModules();

// Make functions available globally
window.checkBeautyEffect = checkBeautyEffect;
window.testBeautyEffect = testBeautyEffect;
window.setBeautyLevel = setBeautyLevel;
window.checkLoadedModules = checkLoadedModules;

console.log('✅ Debug functions available:');
console.log('  - checkBeautyEffect() - Check beauty effect status');
console.log('  - testBeautyEffect() - Test beauty effect application');
console.log('  - setBeautyLevel(level) - Set beauty level (0-3)');
console.log('  - checkLoadedModules() - Check loaded modules');

console.log('🎯 Ready to debug beauty effect!');
