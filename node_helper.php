<?php
/**
 * Helper function untuk mendapatkan path Node.js yang tepat
 * Kompatibel dengan Windows, macOS, dan Linux
 */
function getNodePath() {
    // Coba cari node di PATH system terlebih dahulu (paling universal)
    if (function_exists('exec')) {
        $isWindows = strtoupper(substr(PHP_OS, 0, 3)) === 'WIN';
        $findCommand = $isWindows ? 'where node' : 'which node';
        
        @exec($findCommand, $output, $returnCode);
        if ($returnCode === 0 && !empty($output[0])) {
            return trim($output[0]);
        }
    }
    
    // Fallback untuk path default di setiap OS
    $isWindows = strtoupper(substr(PHP_OS, 0, 3)) === 'WIN';
    
    if ($isWindows) {
        // Windows - biasanya node ada di PATH atau di folder instalasi
        return 'node';
    } else {
        // macOS dengan Homebrew
        if (file_exists('/opt/homebrew/bin/node')) {
            return '/opt/homebrew/bin/node';
        }
        // Linux atau macOS dengan instalasi lain
        return 'node';
    }
}
?>
