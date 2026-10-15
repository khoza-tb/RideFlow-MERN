export function haversineKm(a,b,c,d){const R=6371,rad=x=>x*Math.PI/180;const x=rad(c-a),y=rad(d-b);const h=Math.sin(x/2)**2+Math.cos(rad(a))*Math.cos(rad(c))*Math.sin(y/2)**2;return R*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));}
export function etaMinutes(km){return Math.max(5,Math.round(km*2.4));}
