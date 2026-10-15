import multer from "multer";
import path from "path";
import fs from "fs";

const dir=path.resolve("uploads");
fs.mkdirSync(dir,{recursive:true});
const storage=multer.diskStorage({
  destination:(_,__,cb)=>cb(null,dir),
  filename:(_,file,cb)=>cb(null,`${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname)}`)
});
const allowed=["image/jpeg","image/png","application/pdf","image/webp"];
export const upload=multer({storage,limits:{fileSize:5*1024*1024},fileFilter:(_,file,cb)=>cb(null,allowed.includes(file.mimetype))});
