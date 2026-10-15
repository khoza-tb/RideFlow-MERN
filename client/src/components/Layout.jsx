import Navbar from "./Navbar";import {useLocation} from "react-router-dom";
export default function Layout({children}){const loc=useLocation();const app=loc.pathname.startsWith("/dashboard")||loc.pathname.startsWith("/driver")||loc.pathname.startsWith("/admin");return <>{!app&&<Navbar/>}{children}</>}
