<?php
// public/upload_kotoba.php - Dedicated Lightweight Upload Endpoint untuk Gambar Kosakata (Kotoba)
// Menerima file gambar via POST multipart/form-data atau Base64, me-resize via GD ke WebP/JPEG,
// dan menyimpannya di direktori uploads/kotoba/ sehingga database hanya menyimpan URL pendek.

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Hanya metode POST yang diizinkan']);
    exit;
}

$targetDir = __DIR__ . '/uploads/kotoba/';
if (!file_exists($targetDir)) {
    if (!@mkdir($targetDir, 0755, true)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Gagal membuat folder penyimpanan gambar']);
        exit;
    }
}

// 1. Tangani Upload via File Form (multipart/form-data)
$file = null;
if (isset($_FILES['image']) && is_uploaded_file($_FILES['image']['tmp_name'])) {
    $file = $_FILES['image'];
} elseif (isset($_FILES['file']) && is_uploaded_file($_FILES['file']['tmp_name'])) {
    $file = $_FILES['file'];
} elseif (isset($_FILES['kotoba']) && is_uploaded_file($_FILES['kotoba']['tmp_name'])) {
    $file = $_FILES['kotoba'];
}

if ($file) {
    if ($file['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Terjadi kesalahan saat upload file (Kode: ' . $file['error'] . ')']);
        exit;
    }

    // Maksimal 12MB untuk foto kamera HP
    if ($file['size'] > 12 * 1024 * 1024) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Ukuran gambar maksimal 12MB']);
        exit;
    }

    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    if (!in_array($ext, $allowed)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Format file tidak didukung. Gunakan JPG, PNG, atau WebP']);
        exit;
    }

    $tmpPath = $file['tmp_name'];
    $uniqueId = time() . '_' . substr(bin2hex(random_bytes(6)), 0, 10);

    // Coba optimasi & resize via PHP GD jika tersedia
    $saved = false;
    $finalExt = $ext;

    if (extension_loaded('gd') && function_exists('imagecreatefromstring')) {
        $imgData = @file_get_contents($tmpPath);
        if ($imgData !== false) {
            $srcImg = @imagecreatefromstring($imgData);
            if ($srcImg !== false) {
                // Auto orient jika ada exif
                if (function_exists('exif_read_data') && ($ext === 'jpg' || $ext === 'jpeg')) {
                    $exif = @exif_read_data($tmpPath);
                    if (!empty($exif['Orientation'])) {
                        switch ($exif['Orientation']) {
                            case 3:
                                $srcImg = imagerotate($srcImg, 180, 0);
                                break;
                            case 6:
                                $srcImg = imagerotate($srcImg, -90, 0);
                                break;
                            case 8:
                                $srcImg = imagerotate($srcImg, 90, 0);
                                break;
                        }
                    }
                }

                $origW = imagesx($srcImg);
                $origH = imagesy($srcImg);
                $maxDim = 800; // Resolusi ideal untuk thumbnail kartu kosakata

                if ($origW > $maxDim || $origH > $maxDim) {
                    if ($origW > $origH) {
                        $newW = $maxDim;
                        $newH = (int)round(($origH * $maxDim) / $origW);
                    } else {
                        $newH = $maxDim;
                        $newW = (int)round(($origW * $maxDim) / $origH);
                    }
                } else {
                    $newW = $origW;
                    $newH = $origH;
                }

                $dstImg = imagecreatetruecolor($newW, $newH);

                // Preserve transparency untuk PNG/WebP
                imagealphablending($dstImg, false);
                imagesavealpha($dstImg, true);
                $transparent = imagecolorallocatealpha($dstImg, 255, 255, 255, 127);
                imagefilledrectangle($dstImg, 0, 0, $newW, $newH, $transparent);

                imagecopyresampled($dstImg, $srcImg, 0, 0, 0, 0, $newW, $newH, $origW, $origH);

                // Utamakan format WebP untuk efisiensi kompresi tinggi (biasanya ~25KB)
                if (function_exists('imagewebp')) {
                    $finalExt = 'webp';
                    $newFileName = 'kotoba_' . $uniqueId . '.webp';
                    $targetFilePath = $targetDir . $newFileName;
                    if (@imagewebp($dstImg, $targetFilePath, 80)) {
                        $saved = true;
                    }
                }

                // Fallback ke JPEG jika WebP gagal
                if (!$saved && function_exists('imagejpeg')) {
                    $finalExt = 'jpg';
                    $newFileName = 'kotoba_' . $uniqueId . '.jpg';
                    $targetFilePath = $targetDir . $newFileName;
                    if (@imagejpeg($dstImg, $targetFilePath, 80)) {
                        $saved = true;
                    }
                }

                imagedestroy($srcImg);
                imagedestroy($dstImg);
            }
        }
    }

    // Jika GD tidak aktif atau gagal, salin file mentah langsung
    if (!$saved) {
        $newFileName = 'kotoba_' . $uniqueId . '.' . $ext;
        $targetFilePath = $targetDir . $newFileName;
        if (move_uploaded_file($tmpPath, $targetFilePath)) {
            $saved = true;
        }
    }

    if ($saved) {
        $protocol = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http");
        $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
        $fullUrl = $protocol . "://" . $host . "/uploads/kotoba/" . $newFileName;
        $relativeUrl = "/uploads/kotoba/" . $newFileName;

        echo json_encode([
            'success'      => true,
            'url'          => $fullUrl,
            'relative_url' => $relativeUrl,
            'file_name'    => $newFileName,
        ]);
        exit;
    }
}

// 2. Tangani Upload via Base64 JSON payload (jika dikirim string base64)
$rawInput = file_get_contents('php://input');
if ($rawInput) {
    $body = json_decode($rawInput, true);
    $base64Data = $body['image_base64'] ?? $body['data_url'] ?? null;
    if ($base64Data && preg_match('/^data:image\/(\w+);base64,/', $base64Data, $typeMatch)) {
        $imgType = strtolower($typeMatch[1]);
        if ($imgType === 'jpeg') $imgType = 'jpg';
        $dataPart = substr($base64Data, strpos($base64Data, ',') + 1);
        $decoded = base64_decode($dataPart);

        if ($decoded !== false) {
            $uniqueId = time() . '_' . substr(bin2hex(random_bytes(6)), 0, 10);
            $newFileName = 'kotoba_' . $uniqueId . '.' . ($imgType === 'png' ? 'png' : 'jpg');
            $targetFilePath = $targetDir . $newFileName;

            if (file_put_contents($targetFilePath, $decoded) !== false) {
                $protocol = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http");
                $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
                $fullUrl = $protocol . "://" . $host . "/uploads/kotoba/" . $newFileName;
                $relativeUrl = "/uploads/kotoba/" . $newFileName;

                echo json_encode([
                    'success'      => true,
                    'url'          => $fullUrl,
                    'relative_url' => $relativeUrl,
                    'file_name'    => $newFileName,
                ]);
                exit;
            }
        }
    }
}

http_response_code(400);
echo json_encode(['success' => false, 'message' => 'Tidak ada file gambar atau data base64 yang valid']);
exit;
