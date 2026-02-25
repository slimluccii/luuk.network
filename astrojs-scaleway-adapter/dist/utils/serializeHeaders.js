function n(e){let o={};if(e.forEach((t,i)=>{i.toLowerCase()==="content-type"?o["Content-Type"]=t:o[i]=t}),"getSetCookie"in e&&typeof e.getSetCookie=="function"){let t=e.getSetCookie();t.length>0&&(o["Set-Cookie"]=t.join(", "))}return o}export{n as serializeHeaders};
//# sourceMappingURL=serializeHeaders.js.map
