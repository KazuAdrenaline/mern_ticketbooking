import React from 'react'
import { assets } from '../assets/assets'
import { ArrowRight, ClockIcon } from 'lucide-react'
import bgImage from '../assets/demon.jpg'
import { useNavigate } from 'react-router-dom'

const HeroSection = () => {
  const navigate = useNavigate()
  
  return (
    <div
      className="relative flex flex-col items-start justify-center gap-4
      px-6 md:px-16 lg:px-36 bg-cover bg-center h-screen"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      {/* Overlay mờ để chữ nổi bật hơn */}
      <div className="absolute inset-0 bg-black/40"></div>

      {/* Nội dung */}
      <div className="relative z-10">
        {/* Logo */}
        <img
          src={assets.marvelLogo} // nếu có logo Kimetsu thì thay ở đây
          alt="Kimetsu no Yaiba Logo"
          className="max-h-11 lg:h-11"
        />

        {/* Tiêu đề */}
        <h1 className="text-5xl md:text-[70px] md:leading-tight font-semibold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
          Kimetsu no Yaiba <br />
          Demon Slayer
        </h1>

        {/* Thông tin phim */}
        <div className="flex items-center gap-4 text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
          <span>Action | Fantasy | Adventure</span>
          <div className="flex items-center gap-1">
            2019
            <ClockIcon className="w-5 h-5" /> 26 Episodes
          </div>
        </div>

        {/* Mô tả phim */}
        <p className='max-w-md text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]'>
          Tanjiro Kamado, a kindhearted boy who sells charcoal, finds his family 
          slaughtered by demons. His sister Nezuko survives, but has been turned 
          into a demon. To restore her humanity, Tanjiro joins the Demon Slayer Corps.
        </p>

        {/* Nút bấm */}
        <button
          onClick={() => navigate('/movies')}
          className='flex items-center gap-1 px-6 py-3 text-sm bg-primary 
          hover:bg-primary-dull transition rounded-full font-medium cursor-pointer text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]'
        >
          Explore Kimetsu
          <ArrowRight className='w-5 h-5' />
        </button>
      </div>
    </div>
  )
}

export default HeroSection
