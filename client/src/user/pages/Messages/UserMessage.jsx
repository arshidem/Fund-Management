import React, { useState, useEffect } from "react";
import { Routes, Route, useSearchParams, useNavigate, useParams } from "react-router-dom";
import { useAppContext } from "../../../context/AppContext";
import ChatList from "./ChatList";
import ChatWindow from "./ChatWindow";
import clsx from "clsx";

const UserMessage = () => {
  const { isMobile } = useAppContext();
  const [activeChat, setActiveChat] = useState(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { chatId } = useParams();
  
  const directChatUserId = searchParams.get('directChat');

  // 🔹 Handle direct chat from URL parameter
  useEffect(() => {
    if (directChatUserId && !isMobile) {
      console.log("Direct chat requested for user:", directChatUserId);
      // You can load the specific chat here
    }
  }, [directChatUserId, isMobile]);

  // 🔹 Handle chat selection from ChatList
  const handleChatSelect = (chat) => {
    console.log("💬 Chat selected:", chat);
    setActiveChat(chat);

    if (isMobile) {
      // Mobile: Navigate to chat route
      const chatRoute = `/messages/chat/${chat.type === "individual" ? chat.user?._id : chat.eventId}`;
      navigate(chatRoute, { state: { chat } });
    } else {
      // Desktop: Update URL without full navigation
      const chatPath = `/messages/chat/${chat.type === "individual" ? chat.user?._id : chat.eventId}`;
      window.history.pushState({}, '', chatPath);
    }
  };

  // 🔹 Handle back navigation on mobile
  const handleBackToChatList = () => {
    navigate('/messages');
    setActiveChat(null);
  };

  // 🔹 Handle initial chat from URL on desktop
  useEffect(() => {
    if (!isMobile && chatId && !activeChat) {
      // You might want to fetch the actual chat data here
      const reconstructedChat = {
        type: 'individual',
        user: { _id: chatId },
        lastMessage: null,
        lastMessageAt: null,
        unreadCount: 0
      };
      setActiveChat(reconstructedChat);
    }
  }, [chatId, isMobile, activeChat]);

  // 🔹 Close chat in desktop view
  const handleCloseChat = () => {
    setActiveChat(null);
    navigate('/messages'); // Reset URL
  };

  if (isMobile) {
    // Mobile: Use routing - show only one at a time
    return (
      <div className="h-full bg-gray-50 dark:bg-gray-900">
        <Routes>
          <Route 
            path="/" 
            element={
              <div className="h-full">
                <ChatList 
                  onChatSelect={handleChatSelect}
                />
              </div>
            } 
          />
          <Route 
            path="/chat/:chatId" 
            element={
              <div className="h-full">
                <ChatWindow 
                  onBack={handleBackToChatList}
                />
              </div>
            } 
          />
        </Routes>
      </div>
    );
  } else {
    // Desktop: Show both side by side (fixed layout)
    return (
      <div className="h-full bg-gray-50 dark:bg-gray-900 p-4">
        <div className="flex h-full bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          {/* Chat List - Fixed width, always visible */}
          <div className="w-1/3 min-w-80 max-w-96 border-r border-gray-200 dark:border-gray-700">
            <ChatList 
              onChatSelect={handleChatSelect}
              activeChatId={activeChat?.user?._id || activeChat?.eventId}
            />
          </div>
          
          {/* Chat Window - Flexible width */}
          <div className="flex-1 flex flex-col">
            {activeChat ? (
              <ChatWindow 
                activeChat={activeChat} 
                onChatClose={handleCloseChat}
                isDesktop={true}
              />
            ) : (
              // Empty state when no chat selected
              <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-800">
                <div className="text-center text-gray-400 dark:text-gray-500">
                  <div className="text-6xl mb-4">💬</div>
                  <h3 className="text-xl font-semibold mb-2">Select a conversation</h3>
                  <p className="text-sm">Choose a chat from the list to start messaging</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
};

export default UserMessage;