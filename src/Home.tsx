import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Input } from "./components/ui/input";
import { useNavigate } from "react-router-dom";
import { Label } from "./components/ui/label";

function Home() {
  const [id, setId] = useState<string | null>(null);
  const navigate = useNavigate();

  return (
    <div className="flex min-h-svh flex-col items-center justify-center">
      <div className="flex flex-col items-center justify-center p-4 border rounded-lg shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4 text-center">Cumulative Limit Tracker (better than Brzana's one)</h2>
        <Label className="mb-2">
            Enter Competition ID
        </Label>
        <Input
          value={id ?? ""}
          onChange={(e) => setId(e.target.value)}
          placeholder="Enter competition ID"
        />
        <Button onClick={() => navigate(`/competition/${id}`)} disabled={!id} className="mt-4">
          Go
        </Button>
      </div>
    </div>
  );
}

export default Home;
