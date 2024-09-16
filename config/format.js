'use-strict';

const moment = require('moment');
const logger = require('./logger');
const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni", 
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];
const monthsInNumber = {
    'Januari': '1',
    'Februari': '2',
    'Maret': '3',
    'April': '4',
    'Mei': '5',
    'Juni': '6',
    'Juli': '7',
    'Agustus': '8',
    'September': '9',
    'Oktober': '10',
    'November': '11',
    'Desember': '12'
};

exports.getCurrentTimeInJakarta = function (date, format) {
    return moment(date).tz('Asia/Jakarta').format(format);
}

exports.dateFormat = async function(date, type){
    try{
        const newDate = moment(date).format(type);
        return newDate;
    } catch (e){
        logger.errorWithContext({message: 'Error formating date', error: e});
        throw e;
    }
}

exports.rupiahFormat = async function(rupiah, elit){
    try{
        const newRupiah = 'Rp ' + rupiah.toString().replace(/\B(?=(\d{3})+(?!\d))/g, `${elit}`)
        return newRupiah;
    } catch (e){
        logger.errorWithContext({message: 'error formating rupiah', error: e});
        return 'Rp 0'
    }
}

exports.isEmpty = function (data) {
    if(typeof(data) === 'object'){
        if(JSON.stringify(data) === '{}' || JSON.stringify(data) === '[]'){
            return true;
        }else if(!data){
            return true;
        }
        return false;
    }else if(typeof(data) === 'string'){
        if(!data.trim()){
            return true;
        }
        return false;
    }else if(typeof(data) === 'undefined'){
        return true;
    }else{
        return false;
    }
}

exports.dateFormatIndo = async function(date){
  try {
    const dateObj = moment(date).locale("id");
    if (!dateObj.isValid()) {
      throw new Error('Invalid date');
    }
    const newDate = dateObj.format('DD-MMMM-YYYY');
    return newDate;
  } catch (e) {
    logger.errorWithContext({message: 'error formatting date', error: e});
    return '-';
  }
}

exports.convertToLiteralMonth = function(month) {
    // Convert month number to Indonesian month name
    const monthName = months[parseInt(month) - 1];

    // Return the formatted date string
    return monthName;
}

exports.convertToLiteralDate = function(dateString) {
    // Split the date string into year, month, and day
    const [year, month, day] = dateString.split("-");

    // Convert month number to Indonesian month name
    const monthName = months[parseInt(month) - 1];

    // Return the formatted date string
    return `${parseInt(day)} ${monthName} ${year}`;
}

exports.generateRandomValue = function (min, max) {
    // Ensure min and max are integers
    min = Math.ceil(min);
    max = Math.floor(max);

    // Generate a random integer between min and max (inclusive)
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

exports.convertToIntMonth = function(month) {
    return monthsInNumber[month] || '';
}
