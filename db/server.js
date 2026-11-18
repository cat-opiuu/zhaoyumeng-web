/*
  作者：赵予萌
  建立时间：2026-11-13 10:00:00
  使用大模型：GLM-5.3-Flash
  功能名称：数据服务器——提供 /api/poems 接口并托管项目根目录静态文件，端口 3004
  启动方式：在本文件所在 db 文件夹执行 node server.js
*/
var zym_http = require("http");
var zym_fs = require("fs");
var zym_path = require("path");
var zym_port = 3004;
// 网站根目录：server.js 在 db 文件夹里，向上退一级即为项目根目录
var zym_root = zym_path.resolve(__dirname, "..");

// 功能：根据请求路径返回对应的 MIME 类型
function zym_getMime(zym_ext) {
  var zym_map = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
  };
  return zym_map[zym_ext] || "application/octet-stream";
}

// 功能：图片代理——/api/img?url=仅允许 gitee.com 的图片地址，
//       服务器端跟随跳转取图后转发给浏览器（同源响应，避免跨域图床被 ORB 拦截）
async function zym_proxyImg(zym_req, zym_res, zym_query) {
  var zym_imgUrl;
  try { zym_imgUrl = new URL(zym_query.get("url")); }
  catch (zym_e) { zym_res.writeHead(400); zym_res.end("400 Bad url"); return; }

  // 安全限制：只代理 gitee.com 域名的图片，防止接口被滥用
  if (zym_imgUrl.hostname !== "gitee.com") {
    zym_res.writeHead(403); zym_res.end("403 只允许代理 gitee.com 图片"); return;
  }
  try {
    var zym_resp = await fetch(zym_imgUrl, { redirect: "follow" });
    if (!zym_resp.ok) { zym_res.writeHead(502); zym_res.end("502 图床返回 " + zym_resp.status); return; }
    var zym_buf = Buffer.from(await zym_resp.arrayBuffer());
    zym_res.writeHead(200, {
      "Content-Type": zym_resp.headers.get("content-type") || "image/jpeg",
      "Cache-Control": "max-age=86400",
    });
    zym_res.end(zym_buf);
  } catch (zym_e) {
    zym_res.writeHead(502); zym_res.end("502 获取图片失败");
  }
}

// 功能：创建 HTTP 服务器——/api/poems 返回 db.json 数据，其余路径按静态文件托管
var zym_server = zym_http.createServer(function (zym_req, zym_res) {
  var zym_parsed = new URL(zym_req.url, "http://localhost");
  var zym_url = decodeURIComponent(zym_parsed.pathname);

  // 数据接口：读取同文件夹下的 db.json 原样返回
  if (zym_url === "/api/poems") {
    var zym_dbPath = zym_path.join(__dirname, "db.json");
    zym_fs.readFile(zym_dbPath, "utf8", function (zym_err, zym_data) {
      if (zym_err) {
        zym_res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        zym_res.end(JSON.stringify({ error: "读取 db.json 失败" }));
        return;
      }
      zym_res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      zym_res.end(zym_data);
    });
    return;
  }

  // 图片代理接口
  if (zym_url === "/api/img") {
    zym_proxyImg(zym_req, zym_res, zym_parsed.searchParams);
    return;
  }

  // 静态文件：默认打开根目录的 index.html；路径做安全处理，禁止跳出项目根目录
  if (zym_url === "/") zym_url = "/index.html";
  var zym_filePath = zym_path.normalize(zym_path.join(zym_root, zym_url));
  if (!zym_filePath.startsWith(zym_root)) {
    zym_res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    zym_res.end("403 Forbidden");
    return;
  }
  zym_fs.readFile(zym_filePath, function (zym_err, zym_data) {
    if (zym_err) {
      zym_res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      zym_res.end("404 Not Found");
      return;
    }
    zym_res.writeHead(200, { "Content-Type": zym_getMime(zym_path.extname(zym_filePath).toLowerCase()) });
    zym_res.end(zym_data);
  });
});

// 功能：监听 3004 端口并在控制台打印访问地址
zym_server.listen(zym_port, function () {
  console.log("数据服务器已启动：http://localhost:" + zym_port);
  console.log("古诗页面：http://localhost:" + zym_port + "/poems.html");
  console.log("数据接口：http://localhost:" + zym_port + "/api/poems");
});
