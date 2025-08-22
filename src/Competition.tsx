import { type Competition, type Person } from "@wca/helpers";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getWcif } from "./lib/wcaApi";
import IconButton from "./components/ui/icon-button";
import EventIcon from "./components/EventIcon";
import Tracker from "./components/Tracker";

const CompetitionPage = () => {
  const [wcif, setWcif] = useState<Competition | null>(null);
  const [rounds, setRounds] = useState<string[]>([]);
  const [limit, setLimit] = useState(0); 
  const { id } = useParams<{ id: string }>();
  const [persons, setPersons] = useState<Person[]>([]);

  useEffect(() => {
    getWcif(id!)
      .then((data) => {
        setWcif(data);
      })
      .catch((error) => {
        console.error("Error fetching competition data:", error);
      });
  }, [id]);

  const handleAddFirstRound = (eventId: string) => {
    if (rounds.includes(`${eventId}-r1`)) {
      setRounds((prev) => prev.filter((r) => r !== `${eventId}-r1`));
      return;
    }
    if (limit === 0) {
        const round = wcif?.events
            .find((event) => event.id === eventId)
            ?.rounds.find((r) => r.id === `${eventId}-r1`);
        setLimit(round?.timeLimit?.centiseconds || 0);
    }
    addPersonsRegistedForAnEvent(eventId);
    setRounds((prev) => [...prev, `${eventId}-r1`]);
  };

  const addPersonsRegistedForAnEvent = (eventId: string) => {
    if (!wcif) return;

    const personsForEvent = wcif.persons.filter((person) =>
      person.registration?.eventIds.includes(eventId as any)
    );

    setPersons((prev) => {
      const newPersons = personsForEvent.filter(
        (p) =>
          !prev.some((existing) => existing.registrantId === p.registrantId)
      );
      return [...prev, ...newPersons];
    });
  };

  return (
    <div className="flex min-h-svh flex-col items-center justify-center">
      <h1 className="text-2xl font-bold mb-4">Competition: {id}</h1>
      {wcif ? (
        <>
          <div className="bg-gray-100 p-4 rounded-lg w-full max-w-2xl">
            {wcif.events.map((event) => (
              <IconButton
                icon={
                  <EventIcon
                    eventId={event.id}
                    selected={rounds.includes(`${event.id}-r1`)}
                  />
                }
                className="w-16"
                onClick={() => handleAddFirstRound(event.id)}
                key={event.id}
              />
            ))}
          </div>
          <div className="flex flex-wrap mt-5 gap-3">
            {persons.map((person) => (
              <Tracker person={person} roundIds={rounds} events={wcif.events} limit={limit} key={person.registrantId} />
            ))}
          </div>
        </>
      ) : (
        <p className="text-gray-500">Loading competition data...</p>
      )}
    </div>
  );
};

export default CompetitionPage;
