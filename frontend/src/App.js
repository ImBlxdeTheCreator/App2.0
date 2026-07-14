import { useEffect, useCallback } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import axios from "axios";
import { HOME } from "@/constants/testIds";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Home = () => {
  const helloWorldApi = useCallback(async () => {
    try {
      await axios.get(`${API}/`);
    } catch (e) {
      if (process.env.NODE_ENV === "development") {
        console.error("errored out requesting / api", e);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // `API` and `axios` are module-level constants (stable references), so
    // they don't need to be in the dependency array.
  }, []);

  useEffect(() => {
    helloWorldApi();
  }, [helloWorldApi]);

  return (
    <div>
      <header className="App-header">
        <a
          data-testid={HOME.emergentLink}
          className="App-link"
          href="https://emergent.sh"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img src="https://avatars.githubusercontent.com/in/1201222?s=120&u=2686cf91179bbafbc7a71bfbc43004cf9ae1acea&v=4" />
        </a>
        <p className="mt-5">Building something incredible ~!</p>
      </header>
    </div>
  );
};

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />}>
            <Route index element={<Home />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
