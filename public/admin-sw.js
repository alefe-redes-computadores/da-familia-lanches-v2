importScripts("https://www.gstatic.com/firebasejs/12.7.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.7.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey:"AIzaSyATQBcbYuzKpKlSwNlbpRiAM1XyHqhGeak",
  authDomain:"da-familia-lanches.firebaseapp.com",
  projectId:"da-familia-lanches",
  storageBucket:"da-familia-lanches.appspot.com",
  messagingSenderId:"106857147317",
  appId:"1:106857147317:web:769c98aed26bb8fc9e87fc",
});

const messaging = firebase.messaging();
const CACHE = "dfl-admin-v20";
const SHELL = ["/admin", "/admin-manifest.webmanifest", "/admin-icon-192x192.png", "/admin-icon-512x512.png", "/admin-notification-badge.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => Promise.allSettled(SHELL.map((url) => cache.add(url)))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("dfl-admin-") && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  const request=event.request; if(request.method!=="GET") return;
  const url=new URL(request.url); if(url.origin!==self.location.origin || url.pathname.startsWith("/api/")) return;
  if(request.mode==="navigate"){
    event.respondWith(fetch(request).then((response)=>{const copy=response.clone();caches.open(CACHE).then((cache)=>cache.put(request,copy));return response;}).catch(async()=> (await caches.match(request)) || (await caches.match("/admin")))); return;
  }
  if(url.pathname.startsWith("/_next/static/") || /admin-(icon|apple|notification)/.test(url.pathname)){
    event.respondWith(caches.match(request).then((cached)=>cached || fetch(request).then((response)=>{const copy=response.clone();caches.open(CACHE).then((cache)=>cache.put(request,copy));return response;})));
  }
});

async function hasVisibleAdminClient(){
  const clients=await self.clients.matchAll({type:"window",includeUncontrolled:true});
  return clients.some((client)=>client.visibilityState==="visible");
}
async function showAdminNotification(payload){
  const data=payload||{}; if(!data.forceVisible && await hasVisibleAdminClient()) return;
  await self.registration.showNotification(data.title||"DFL Admin",{
    body:data.body||"Há uma atualização na operação.",
    tag:data.tag||data.orderId||"dfl-admin-operation",
    renotify:true,
    icon:"/admin-icon-192x192.png",
    badge:"/admin-notification-badge.png",
    vibrate:[180,90,180],
    data:{url:data.url||"/admin",orderId:data.orderId||null},
  });
}
messaging.onBackgroundMessage((payload)=>showAdminNotification(payload?.data||{}));
self.addEventListener("message",(event)=>{if(event.data?.type!=="DFL_ADMIN_NOTIFY")return;event.waitUntil(showAdminNotification(event.data.payload||{}));});
self.addEventListener("notificationclick",(event)=>{
  event.notification.close(); const target=new URL(event.notification.data?.url||"/admin",self.location.origin).href;
  event.waitUntil(self.clients.matchAll({type:"window",includeUncontrolled:true}).then((clients)=>{for(const client of clients){if("focus" in client){client.navigate(target);return client.focus();}}return self.clients.openWindow(target);}));
});
