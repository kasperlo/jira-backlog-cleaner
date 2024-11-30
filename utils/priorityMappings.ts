// utils/priorityMappings.ts

import { IconType } from 'react-icons';
import { MdOutlineKeyboardDoubleArrowUp, MdOutlineKeyboardControlKey, MdOutlineKeyboardDoubleArrowDown, MdOutlineKeyboardArrowDown, MdOutlineHorizontalRule } from "react-icons/md";




export const priorityColorMap: { [key: string]: { color: string } } = {
    'Highest': { color: '#FF4500' }, // OrangeRed
    'High': { color: '#FFA500' },    // Orange
    'Medium': { color: '#FFD700' },  // Gold (Yellow)
    'Low': { color: '#1E90FF' },     // DodgerBlue
    'Lowest': { color: '#6495ED' },  // CornflowerBlue
};

export const priorityIconMap: { [key: string]: IconType } = {
  'Highest': MdOutlineKeyboardDoubleArrowUp,
  'High': MdOutlineKeyboardControlKey,
  'Medium': MdOutlineHorizontalRule,
  'Low': MdOutlineKeyboardArrowDown,
  'Lowest': MdOutlineKeyboardDoubleArrowDown,
};
