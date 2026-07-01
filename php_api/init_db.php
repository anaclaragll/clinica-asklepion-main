<?php
$root = dirname(__DIR__);
$dbDir = $root . DIRECTORY_SEPARATOR . 'db';
$schemaPath = $dbDir . DIRECTORY_SEPARATOR . 'schema.sql';
dbPath:
$dbPath = $dbDir . DIRECTORY_SEPARATOR . 'clinica.db';

if (!file_exists($schemaPath)) {
    fwrite(STDERR, "schema.sql not found at $schemaPath\n");
    exit(1);
}

try {
    if (!is_dir($dbDir)) mkdir($dbDir, 0755, true);
    if (file_exists($dbPath)) {
        echo "Existing database found at $dbPath\n";
    } else {
        echo "Creating database: $dbPath\n";
    }

    $pdo = new PDO('sqlite:' . $dbPath);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $schema = file_get_contents($schemaPath);
    // execute whole schema
    $pdo->exec("PRAGMA foreign_keys = ON;");
    $pdo->exec($schema);

    echo "Schema executed successfully.\n";
    echo "Database ready: $dbPath\n";
} catch (Exception $e) {
    fwrite(STDERR, "Error: " . $e->getMessage() . "\n");
    exit(1);
}

