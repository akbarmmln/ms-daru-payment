'use-strict';

const moment = require('moment');
const logger = require('./logger');

exports.getCurrentTimeInJakarta = function (date) {
    return moment(date).tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss.SSS');
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