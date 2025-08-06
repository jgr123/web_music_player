import React, { useState, useEffect } from 'react';
import axios from 'react';
import { FaThumbsUp, FaThumbsDown } from 'react-icons/fa';

const LikeButtons = ({ track, userId }) => {
  const [userRating, setUserRating] = useState(0);

  useEffect(() => {
    const fetchRating = async () => {
      try {
        const response = await axios.get(`http://localhost:5000/api/ratings/${userId}`);
        const ratingObj = response.data.find(r => r.musica_id === track.id);
        if (ratingObj) setUserRating(ratingObj.rating);
      } catch (error) {
        console.error('Erro ao buscar avaliação:', error);
      }
    };
    
    if (userId && track) fetchRating();
  }, [track, userId]);

  const handleRate = async (rating) => {
    try {
      await axios.post('http://localhost:5000/api/rate', {
        musica_id: track.id,
        user_id: userId,
        rating
      });
      setUserRating(rating);
    } catch (error) {
      console.error('Erro ao avaliar:', error);
    }
  };

  return (
    <div className="like-buttons">
      <button
        onClick={() => handleRate(1)}
        className={userRating === 1 ? 'liked' : ''}
      >
        <FaThumbsUp /> Gostei
      </button>
      <button
        onClick={() => handleRate(-1)}
        className={userRating === -1 ? 'disliked' : ''}
      >
        <FaThumbsDown /> Não Gostei
      </button>
    </div>
  );
};

export default LikeButtons;