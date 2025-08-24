import { useState, useCallback } from 'react';
import RadioSelector from '../elements/RadioSelector';
import Button from '../elements/Button';
import { Icon } from '../elements/icons';

interface GenderSelectModalProps {
  readonly isVisible: boolean;
  readonly defaultGender: string;
  readonly onSubmit: (gender: string) => void;
}

function GenderSelectModal({ isVisible, defaultGender, onSubmit }: GenderSelectModalProps) {
  const [gender, setGender] = useState(defaultGender);

  const handleSubmit = useCallback(() => {
    onSubmit(gender.trim() || 'Not Specified');
  }, [gender, onSubmit]);

  if (!isVisible) return null;

  return (
    <div
      aria-labelledby="gender-select-title"
      aria-modal="true"
      className="animated-frame open"
      role="dialog"
    >
      <div className="animated-frame-content flex flex-col items-center">
        <h1
          className="text-2xl font-bold text-sky-300 mb-4"
          id="gender-select-title"
        >
          Choose Your Character&apos;s Gender
        </h1>

        <div className="mb-6 w-full max-w-xs">
          <RadioSelector
            addCustom
            name="heroGender"
            onChange={setGender}
            options={['Male', 'Female']}
            placeholder="Enter custom gender"
            value={gender}
          />
        </div>

        <Button
          ariaLabel="Confirm gender"
          icon={<Icon
            name="bookOpen"
            size={20}
          />}
          label="Continue"
          onClick={handleSubmit}
          preset="green"
          size="lg"
        />
      </div>
    </div>
  );
}

export default GenderSelectModal;
