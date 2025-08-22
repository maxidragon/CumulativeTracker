import { useState } from "react";
import { Modal } from "./Modal";
import type { Competition } from "@wca/helpers";
import IconButton from "./ui/icon-button";
import EventIcon from "./EventIcon";

interface AddRoundModalProps {
  isOpen: boolean;
  onClose: () => void;
  wcif: Competition;
  onAddRound: (roundId: string) => void;
}

const AddRoundModal = ({
  isOpen,
  onClose,
  onAddRound,
  wcif,
}: AddRoundModalProps) => {
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);

  const handleAddFirstRound = (eventId: string) => {
    if (selectedEvents.includes(eventId)) {
        setSelectedEvents((prev) => prev.filter((id) => id !== eventId));
        return;
    }
    setSelectedEvents((prev) => [...prev, eventId]);
    onAddRound(`${eventId}-r1`);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Round">
      <div className="flex flex-col gap-4">
        <div className="flex gap-2 flex-wrap justify-center">
          {wcif.events.map((event) => (
            <IconButton
              icon={
                <EventIcon
                  eventId={event.id}
                  selected={selectedEvents.includes(event.id)}
                />
              }
              className="w-16"
              onClick={() => handleAddFirstRound(event.id)}
              key={event.id}
            />
          ))}
        </div>
      </div>
    </Modal>
  );
};

export default AddRoundModal;
