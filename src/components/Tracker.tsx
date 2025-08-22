import { useEffect, useMemo, useState } from "react";
import { formatCentiseconds, type Event, type Person } from "@wca/helpers";
import EventIcon from "./EventIcon";
import { getNumberOfAttemptsForRoundByFormat } from "@/lib/events";
import AttemptResultInput from "./AttemptResultInput";

interface TrackerProps {
  person: Person;
  roundIds: string[];
  events: Event[];
  limit: number;
}

interface Attempt {
  value: number;
  index: number;
}
const Tracker = ({ person, roundIds, events, limit }: TrackerProps) => {
  const [currentAttempts, setCurrentAttempts] = useState<Attempt[]>([]);
  const filteredRounds = roundIds.filter((roundId) =>
    person.registration?.eventIds.some(
      (eventId) => eventId === roundId.split("-r")[0]
    )
  );

  useEffect(() => {
    const temp: Attempt[] = [];
    let numberOfAttempts = 0;
  
    for (const roundId of filteredRounds) {
      const eventId = roundId.split("-r")[0];
      const event = events.find((e) => e.id === eventId);
      if (event) {
        const round = event.rounds.find((r) => r.id === roundId);
        if (round) {
          numberOfAttempts += getNumberOfAttemptsForRoundByFormat(round.format);
        }
      }
    }
  
    const newAttempts = Array.from({ length: numberOfAttempts }, (_, i) => ({
      value: 0,
      index: i,
    }));
  
    if (currentAttempts.length !== newAttempts.length) {
      setCurrentAttempts(newAttempts);
    }
  }, [filteredRounds, events]);

    
  const calculateLimit = () => {
    const sumOfAttempts = currentAttempts.reduce(
      (acc, attempt) => acc + (attempt.value || 0),
      0
    );
    return limit - sumOfAttempts;
  };

  const remainingLimit = useMemo(
    () => calculateLimit(),
    [currentAttempts, limit]
  );
  return (
    <div className="flex flex-col items-center justify-center p-4 border rounded-lg shadow-md w-full max-w-md">
      <h2>{person.name}</h2>
      <div>
        {filteredRounds.map((eventId) => (
          <EventIcon eventId={eventId.split("-r1")[0]} key={eventId} selected />
        ))}
      </div>
      {currentAttempts.map((attempt) => (
        <AttemptResultInput
          key={attempt.index}
          value={attempt.value}
          onChange={(value) => {
            setCurrentAttempts((prev) =>
              prev.map((a) => (a.index === attempt.index ? { ...a, value } : a))
            );
          }}
          placeholder={`Attempt ${attempt.index + 1}`}
        />
      ))}
      <div className="mt-2">
        <strong>{formatCentiseconds(limit)} </strong>
        <strong>Remaining Limit:</strong> {formatCentiseconds(remainingLimit)}
      </div>
    </div>
  );
};

export default Tracker;
