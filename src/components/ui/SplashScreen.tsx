// src/components/ui/SplashScreen.tsx
// Écran de démarrage affiché le temps de vérifier la session (surtout
// visible à l'ouverture depuis l'icône ajoutée à l'écran d'accueil, où
// l'appli se lance en plein écran comme une vraie appli — un fond blanc nu
// le temps du chargement donnait l'impression d'un bug/site cassé).
export default function SplashScreen() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-sage-800">
      <img src="/pwa-192.png" alt="" className="w-20 h-20 rounded-2xl shadow-lg" />
      <p className="font-bold text-2xl tracking-wide text-white">Animéaux</p>
      <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin mt-2" />
    </div>
  )
}
