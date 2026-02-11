npm init -y
npm install express multer compression helmet cors
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const compression = require("compression");
const helmet = require("helmet");
const cors = require("cors");

const app = express();
const PORT = 3000;

// ===== Security & Performance =====
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

// ===== Ensure Upload Folder Exists =====
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// ===== Safe Filename =====
function sanitizeFilename(name) {
    return name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
}

// ===== Multer Config =====
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueName = Date.now() + "-" + sanitizeFilename(file.originalname);
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 1024 * 1024 * 1024 } // 1GB
}).single("file");

// ===== Home Page =====
app.get("/", (req, res) => {
    res.send(`
<!DOCTYPE html>
<html>
<head>
<title>Fast File Upload</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{
    height:100vh;
    display:flex;
    justify-content:center;
    align-items:center;
    font-family:Arial;
    background:linear-gradient(135deg,#4facfe,#00f2fe);
}
.container{
    background:white;
    padding:40px;
    width:350px;
    border-radius:15px;
    text-align:center;
    box-shadow:0 20px 40px rgba(0,0,0,0.3);
}
h2{margin-bottom:20px;}
input[type=file]{margin:15px 0;}
button{
    background:#4facfe;
    color:white;
    padding:10px 20px;
    border:none;
    border-radius:6px;
    cursor:pointer;
}
button:hover{background:#00c6ff;}
progress{
    width:100%;
    height:20px;
    margin-top:15px;
}
a{
    display:block;
    margin-top:15px;
    color:green;
    font-weight:bold;
}
.error{
    color:red;
    margin-top:10px;
}
</style>
</head>
<body>

<div class="container">
    <h2>🚀 Fast File Upload</h2>
    <input type="file" id="fileInput">
    <button onclick="uploadFile()">Upload</button>
    <progress id="progress" value="0" max="100"></progress>
    <div id="result"></div>
</div>

<script>
function uploadFile() {
    const file = document.getElementById("fileInput").files[0];
    if (!file) {
        alert("Please select a file");
        return;
    }

    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/upload", true);

    xhr.upload.onprogress = function(event) {
        if (event.lengthComputable) {
            const percent = (event.loaded / event.total) * 100;
            document.getElementById("progress").value = percent;
        }
    };

    xhr.onload = function() {
        if (xhr.status !== 200) {
            document.getElementById("result").innerHTML =
                "<div class='error'>Upload failed</div>";
            return;
        }

        try {
            const response = JSON.parse(xhr.responseText);

            if (response.error) {
                document.getElementById("result").innerHTML =
                    "<div class='error'>" + response.error + "</div>";
            } else {
                document.getElementById("result").innerHTML =
                    "<a href='" + response.link + "' target='_blank'>⬇ Download File</a>";
            }
        } catch {
            document.getElementById("result").innerHTML =
                "<div class='error'>Server response error</div>";
        }
    };

    xhr.onerror = function() {
        document.getElementById("result").innerHTML =
            "<div class='error'>Server connection error</div>";
    };

    xhr.send(formData);
}
</script>

</body>
</html>
`);
});

// ===== Upload Route =====
app.post("/upload", function (req, res) {
    upload(req, res, function (err) {
        if (err instanceof multer.MulterError) {
            if (err.code === "LIMIT_FILE_SIZE") {
                return res.json({ error: "File too large (Max 1GB allowed)" });
            }
            return res.json({ error: err.message });
        } else if (err) {
            return res.json({ error: "Upload error occurred" });
        }

        if (!req.file) {
            return res.json({ error: "No file selected" });
        }

        const downloadLink = req.protocol + "://" + req.get("host") + "/download/" + req.file.filename;
        return res.json({ link: downloadLink });
    });
});

// ===== Download Route =====
app.get("/download/:filename", function (req, res) {
    const filePath = path.join(uploadDir, req.params.filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).send("File not found");
    }

    res.download(filePath);
});

// ===== Global Error Handler =====
app.use(function (err, req, res, next) {
    console.error(err);
    res.status(500).send("Internal Server Error");
});

app.listen(PORT, function () {
    console.log("🚀 Server running at http://localhost:" + PORT);
});