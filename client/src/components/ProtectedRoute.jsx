import {Navigate} from "react-router-dom";import {useAuth} from "../context/AuthContext";
export default function ProtectedRoute({roles,children}){const{user,loading}=useAuth();if(loading)return <div className="loader">Loading RideFlow…</div>;if(!user)return <Navigate to="/get-started"/>;return roles&&!roles.includes(user.role)?<Navigate to="/"/>:children}
