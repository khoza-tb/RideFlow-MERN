import jwt from "jsonwebtoken";
export function signUser(user){return jwt.sign({id:String(user._id),role:user.role,name:user.name,email:user.email},process.env.JWT_SECRET,{expiresIn:"7d"});}
export function publicUser(u){return {id:u._id,name:u.name,email:u.email,phone:u.phone,role:u.role,avatar:u.avatar};}
