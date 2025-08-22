import { RouterProvider, createBrowserRouter } from "react-router-dom";
import Home from "./Home";
import CompetitionPage from "./Competition";

const App = () => {
    const router = createBrowserRouter([
      {
        path: "/",
        element: <Home />,  
      },
      {
        path: "/competition/:id",
        element: <CompetitionPage />,
      }
    ]);

    return (
      <RouterProvider 
        router={router} 
      />
    )
};

export default App;