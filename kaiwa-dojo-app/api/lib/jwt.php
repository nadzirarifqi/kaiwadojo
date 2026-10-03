<?php
// api/lib/jwt.php - Pure PHP JWT Implementation (HS256)

require_once __DIR__ . '/../config.php';

class JWT {
    private static function base64UrlEncode(string $data): string {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    private static function base64UrlDecode(string $data): string {
        return base64_decode(strtr($data, '-_', '+/'));
    }

    public static function encode(array $payload, string $secret = JWT_SECRET): string {
        $header = ['typ' => 'JWT', 'alg' => 'HS256'];
        $segments = [
            self::base64UrlEncode(json_encode($header)),
            self::base64UrlEncode(json_encode($payload))
        ];
        $signingInput = implode('.', $segments);
        $signature = hash_hmac('sha256', $signingInput, $secret, true);
        $segments[] = self::base64UrlEncode($signature);
        return implode('.', $segments);
    }

    public static function decode(string $jwt, string $secret = JWT_SECRET): ?array {
        $parts = explode('.', $jwt);
        if (count($parts) !== 3) {
            return null;
        }
        [$headerB64, $payloadB64, $sigB64] = $parts;

        $header = json_decode(self::base64UrlDecode($headerB64), true);
        if (!$header || ($header['alg'] ?? '') !== 'HS256') {
            return null;
        }

        $signingInput = "$headerB64.$payloadB64";
        $signature = self::base64UrlDecode($sigB64);
        $expected = hash_hmac('sha256', $signingInput, $secret, true);

        if (!hash_equals($expected, $signature)) {
            return null;
        }

        $payload = json_decode(self::base64UrlDecode($payloadB64), true);
        if (!$payload) {
            return null;
        }

        if (isset($payload['exp']) && time() >= $payload['exp']) {
            return null; // Expired
        }

        return $payload;
    }
}
