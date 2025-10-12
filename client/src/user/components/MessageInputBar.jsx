import React, { useState } from "react";
import { FaPaperPlane, FaSmile } from "react-icons/fa";

const MessageInputBar = ({ onSend }) => {
  const [message, setMessage] = useState("");

  const handleSend = () => {
    if (message.trim() === "") return; // prevent empty messages
    onSend(message);
    setMessage("");
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSend();
    }
  };

  return (
    <div className="flex items-center p-3 bg-gray-100 border-t border-gray-300">
      {/* Emoji Button */}
      <button className="text-gray-500 text-xl mr-2 hover:text-gray-700">
        <FaSmile />
      </button>

      {/* Input Field */}
      <input
        type="text"
        placeholder="Type a message..."
        className="flex-1 px-4 py-2 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyPress={handleKeyPress}
      />

      {/* Send Button */}
      <button
        onClick={handleSend}
        className="ml-2 bg-blue-500 text-white p-2 rounded-full hover:bg-blue-600 flex items-center justify-center"
      >
        <FaPaperPlane />
      </button>
    </div>
  );
};

export default MessageInputBar;
