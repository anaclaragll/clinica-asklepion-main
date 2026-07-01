<?php
// Router for built-in PHP server. Routes /api/* to php_api/api.php and serves static files otherwise.
$uri = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
$requested = __DIR__ . $uri;
if ($uri !== '/' && file_exists($requested) && !is_dir($requested)) {
    return false; // serve the requested resource as-is
}

if (strpos($uri, '/api') === 0) {
    // pass full URI as PATH_INFO so api.php route checks match
    $_SERVER['PATH_INFO'] = $uri;
    require __DIR__ . '/php_api/api.php';
    return true;
}

// fallback to index.html
$index = __DIR__ . '/index.html';
if (file_exists($index)) {
    require $index;
    return true;
}
http_response_code(404);
echo 'Not Found';
