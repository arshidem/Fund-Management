import React from 'react';

export const TypingIndicator = ({ users }) => {
  return (
    <div className="flex items-center space-x-2 mb-4">
      <div className="bg-white rounded-2xl rounded-bl-none px-4 py-2 border border-gray-200">
        <div className="flex space-x-1">
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
      </div>
      <span className="text-sm text-gray-500">
        {users.join(', ')} {users.length === 1 ? 'is' : 'are'} typing...
      </span>
    </div>
  );
};