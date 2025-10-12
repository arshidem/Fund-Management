import React from 'react';

export const MessageReactions = ({ reactions, onReact }) => {
  return (
    <div className="flex space-x-1 mt-1">
      {reactions.map((reaction, index) => (
        <button
          key={index}
          className="bg-gray-100 rounded-full px-2 py-1 text-xs hover:bg-gray-200"
          onClick={() => onReact(reaction.emoji)}
        >
          {reaction.emoji} {reaction.count > 1 && reaction.count}
        </button>
      ))}
    </div>
  );
};