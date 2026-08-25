<?php
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $targetDir = __DIR__ . '/uploads/avatars/';
    if (!file_exists($targetDir)) {
        mkdir($targetDir, 0755, true);
    }

    if (isset($_FILES['avatar'])) {
        $file = $_FILES['avatar'];
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $allowed = array('jpg', 'jpeg', 'png', 'gif', 'webp', 'svg');

        if (!in_array($ext, $allowed)) {
            echo json_encode(array('success' => false, 'message' => 'Format file tidak didukung'));
            exit;
        }

        $newFileName = 'avatar_' . time() . '_' . uniqid() . '.' . $ext;
        $targetFilePath = $targetDir . $newFileName;

        if (move_uploaded_file($file['tmp_name'], $targetFilePath)) {
            $protocol = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? "https" : "http");
            $url = $protocol . "://" . $_SERVER['HTTP_HOST'] . "/uploads/avatars/" . $newFileName;
            echo json_encode(array('success' => true, 'url' => $url, 'relative_url' => "/uploads/avatars/" . $newFileName));
            exit;
        }
    }

    echo json_encode(array('success' => false, 'message' => 'Gagal mengunggah file'));
    exit;
}
?>
