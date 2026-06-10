<?php
/**
 * Database Configuration and Connection Handler
 * Handles MySQL connection with PDO for secure database operations
 */

class Database {
    private static $instance = null;
    private $connection;
    private $host;
    private $user;
    private $password;
    private $database;
    private $port;

    private function __construct() {
        // Load environment variables from .env file
        $this->loadEnv();
        
        $this->host = getenv('DB_HOST') ?: 'localhost';
        $this->user = getenv('DB_USER') ?: 'root';
        $this->password = getenv('DB_PASSWORD') ?: '';
        $this->database = getenv('DB_NAME') ?: 'clinica_asklepion';
        $this->port = getenv('DB_PORT') ?: 3306;

        $this->connect();
    }

    /**
     * Load environment variables from .env file
     */
    private function loadEnv() {
        $envFile = dirname(__DIR__) . '/.env';
        
        if (file_exists($envFile)) {
            $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            
            foreach ($lines as $line) {
                if (strpos($line, '=') !== false && strpos($line, '#') === false) {
                    list($key, $value) = explode('=', $line, 2);
                    $key = trim($key);
                    $value = trim($value);
                    
                    if (!empty($key)) {
                        putenv("$key=$value");
                    }
                }
            }
        }
    }

    /**
     * Establish database connection using PDO
     */
    private function connect() {
        try {
            $dsn = "mysql:host={$this->host};port={$this->port};dbname={$this->database};charset=utf8mb4";
            
            $this->connection = new PDO(
                $dsn,
                $this->user,
                $this->password,
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES => false,
                ]
            );
        } catch (PDOException $e) {
            die(json_encode([
                'success' => false,
                'message' => 'Erro na conexão com o banco de dados: ' . $e->getMessage()
            ]));
        }
    }

    /**
     * Get singleton instance of Database
     */
    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new Database();
        }
        return self::$instance;
    }

    /**
     * Get PDO connection
     */
    public function getConnection() {
        return $this->connection;
    }

    /**
     * Execute a prepared statement
     */
    public function execute($sql, $params = []) {
        try {
            $stmt = $this->connection->prepare($sql);
            $stmt->execute($params);
            return $stmt;
        } catch (PDOException $e) {
            throw new Exception('Erro na execução da query: ' . $e->getMessage());
        }
    }

    /**
     * Fetch all results
     */
    public function fetchAll($sql, $params = []) {
        $stmt = $this->execute($sql, $params);
        return $stmt->fetchAll();
    }

    /**
     * Fetch single result
     */
    public function fetch($sql, $params = []) {
        $stmt = $this->execute($sql, $params);
        return $stmt->fetch();
    }

    /**
     * Insert record
     */
    public function insert($table, $data) {
        $columns = implode(', ', array_keys($data));
        $placeholders = implode(', ', array_fill(0, count($data), '?'));
        
        $sql = "INSERT INTO $table ($columns) VALUES ($placeholders)";
        
        $stmt = $this->execute($sql, array_values($data));
        return $this->connection->lastInsertId();
    }

    /**
     * Update record
     */
    public function update($table, $data, $where, $whereParams = []) {
        $set = implode(', ', array_map(function($key) {
            return "$key = ?";
        }, array_keys($data)));
        
        $sql = "UPDATE $table SET $set WHERE $where";
        
        $params = array_merge(array_values($data), $whereParams);
        return $this->execute($sql, $params);
    }

    /**
     * Delete record
     */
    public function delete($table, $where, $params = []) {
        $sql = "DELETE FROM $table WHERE $where";
        return $this->execute($sql, $params);
    }

    /**
     * Count records
     */
    public function count($table, $where = '1=1', $params = []) {
        $sql = "SELECT COUNT(*) as count FROM $table WHERE $where";
        $result = $this->fetch($sql, $params);
        return $result['count'] ?? 0;
    }

    /**
     * Log audit trail
     */
    public function logAudit($userId, $action, $table, $recordId, $beforeData = null, $afterData = null, $ipAddress = null) {
        $data = [
            'user_id' => $userId,
            'acao' => $action,
            'tabela' => $table,
            'registro_id' => $recordId,
            'dados_anteriores' => $beforeData ? json_encode($beforeData) : null,
            'dados_novos' => $afterData ? json_encode($afterData) : null,
            'ip_address' => $ipAddress ?: ($_SERVER['REMOTE_ADDR'] ?? null),
        ];
        
        return $this->insert('auditoria', $data);
    }

    /**
     * Log login attempt
     */
    public function logLogin($userId, $success, $failureReason = null) {
        $data = [
            'user_id' => $userId,
            'ip_address' => $_SERVER['REMOTE_ADDR'] ?? null,
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? null,
            'sucesso' => $success ? 1 : 0,
            'motivo_falha' => $failureReason,
        ];
        
        return $this->insert('historico_login', $data);
    }

    /**
     * Prevent cloning
     */
    private function __clone() {}

    /**
     * Prevent unserialization
     */
    public function __wakeup() {}
}
