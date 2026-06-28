<?php
// PHP Database Connection Module using PDO
// Configures connection using Railway's MYSQL_URL or individual fallback parameters

// Helper function to read environment variables (assumes .env is loaded if using dotenv library)
function getEnvVar($key, $default = null) {
    return isset($_ENV[$key]) ? $_ENV[$key] : (getenv($key) !== false ? getenv($key) : $default);
}

// Check for unified connection URL (Railway standard)
$connectionUrl = getEnvVar('MYSQL_URL') ?? getEnvVar('DATABASE_URL');
$dbConfig = [];

if ($connectionUrl) {
    $parsedUrl = parse_url($connectionUrl);
    
    // Parse connection string
    $dbConfig['host'] = $parsedUrl['host'] ?? 'localhost';
    $dbConfig['port'] = $parsedUrl['port'] ?? 3306;
    $dbConfig['user'] = $parsedUrl['user'] ?? 'root';
    $dbConfig['pass'] = $parsedUrl['pass'] ?? '';
    $dbConfig['name'] = isset($parsedUrl['path']) ? ltrim($parsedUrl['path'], '/') : 'capstone_db';
} else {
    // Fallback to individual variables
    $dbConfig['host'] = getEnvVar('MYSQLHOST', 'localhost');
    $dbConfig['port'] = getEnvVar('MYSQLPORT', 3306);
    $dbConfig['user'] = getEnvVar('MYSQLUSER', 'root');
    $dbConfig['pass'] = getEnvVar('MYSQLPASSWORD', '');
    $dbConfig['name'] = getEnvVar('MYSQLDATABASE', 'capstone_db');
}

// Establish PDO connection
try {
    $dsn = "mysql:host={$dbConfig['host']};port={$dbConfig['port']};dbname={$dbConfig['name']};charset=utf8mb4";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];
    
    $pdo = new PDO($dsn, $dbConfig['user'], $dbConfig['pass'], $options);
    // Connection successful
} catch (PDOException $e) {
    // Fail gracefully in production, but log error
    error_log("CRITICAL: Failed to connect to MySQL database: " . $e->getMessage());
    die("Database connection failed. Please check backend logs.");
}
?>
