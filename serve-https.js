const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3443;

// 读取 SSL 证书
const options = {
  key: fs.readFileSync(path.join(__dirname, 'key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'cert.pem'))
};

// 创建静态文件服务器
const server = https.createServer(options, (req, res) => {
  // 移除 URL 中的查询参数（如 ?v=2.1）
  let urlPath = req.url.split('?')[0];
  let filePath = path.join(__dirname, urlPath === '/' ? 'index.html' : urlPath);
  
  const extname = path.extname(filePath);
  const contentTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  };

  const contentType = contentTypes[extname] || 'application/octet-stream';

  // 特殊处理 favicon.ico - 如果不存在则返回空响应
  if (urlPath === '/favicon.ico') {
    fs.readFile(filePath, (error, content) => {
      if (error) {
        // favicon 不存在时返回 204 No Content 而不是 404
        res.writeHead(204);
        res.end();
      } else {
        res.writeHead(200, { 'Content-Type': 'image/x-icon' });
        res.end(content);
      }
    });
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        res.writeHead(404);
        res.end('File not found: ' + urlPath);
      } else {
        res.writeHead(500);
        res.end('Server error: ' + error.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`HTTPS server running at https://localhost:${PORT}`);
});
