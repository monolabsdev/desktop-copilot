import { useEffect } from "react";
import { Overlay } from "../overlay/Overlay";
import { Preferences } from "../preferences/Preferences";

function App() {
  // Preferences window is served via a query param from Tauri.
  const view = new URLSearchParams(window.location.search).get("view");
  const isPreferencesView = view === "preferences";
  useEffect(() => {
    document.documentElement.classList.add("dark");
    document.documentElement.dataset.theme = "dark";
    document.body.dataset.view = isPreferencesView ? "preferences" : "overlay";
  }, [isPreferencesView]);
  if (isPreferencesView) {
    return <Preferences />;
  }

  return (
    <div className="w-screen h-screen m-0 p-0 overflow-hidden">
      <Overlay />
    </div>
  );
}

export default App;
