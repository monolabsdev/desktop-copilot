import { Overlay } from "../overlay/Overlay";
import { Preferences } from "../preferences/Preferences";

function App() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view");
  if (view === "preferences") {
    return <Preferences />;
  }

  return (
    <div className="w-screen h-screen m-0 p-0 overflow-hidden ">
      <Overlay />
    </div>
  );
}

export default App;
