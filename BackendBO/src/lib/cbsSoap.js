'use strict'
/**
 * CBS SOAP Client — Oracle FLEXCUBE (FCUBS)
 * Builds raw SOAP envelopes and posts via axios (avoids wsdl dependency).
 */
const axios  = require('axios');
const xml2js = require('xml2js');

const CBS_URL     = process.env.CBS_SOAP_URL     || 'http://localhost:8080/FCUBSCustomerService';
const CBS_ACC_URL = process.env.CBS_ACC_SOAP_URL  || 'http://10.1.22.100:7003/FCUBSAccService/FCUBSAccService';
const CBS_SOURCE  = process.env.CBS_SOURCE        || 'ADC';
const CBS_USER    = process.env.CBS_USER          || 'ADCUSER';
const CBS_BRANCH  = process.env.CBS_BRANCH        || '001';

async function soapCall(url, soapAction, envelope) {
  const res = await axios.post(url, envelope, {
    headers: {
      'Content-Type': 'text/xml;charset=UTF-8',
      SOAPAction: soapAction,
    },
    timeout: 30000,
  });
  return parseSoapResponse(res.data);
}

async function parseSoapResponse(xml) {
  const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: true });
  const result = await parser.parseStringPromise(xml);
  const body =
    result?.['S:Envelope']?.['S:Body'] ||
    result?.['soapenv:Envelope']?.['soapenv:Body'] ||
    {};
  return body;
}

async function queryCustomer(custNo) {
  const envelope = `
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:fcub="http://fcubs.ofss.com/service/FCUBSCustomerService">
  <soapenv:Header/>
  <soapenv:Body>
    <fcub:QUERYCUSTOMER_IOFS_REQ>
      <fcub:FCUBS_HEADER>
        <fcub:SOURCE>${CBS_SOURCE}</fcub:SOURCE>
        <fcub:UBSCOMP>FCUBS</fcub:UBSCOMP>
        <fcub:USERID>${CBS_USER}</fcub:USERID>
        <fcub:BRANCH>${CBS_BRANCH}</fcub:BRANCH>
        <fcub:SERVICE>FCUBSCustomerService</fcub:SERVICE>
        <fcub:OPERATION>QueryCustomer</fcub:OPERATION>
      </fcub:FCUBS_HEADER>
      <fcub:FCUBS_BODY>
        <fcub:Customer-IO>
          <fcub:CUSTNO>${custNo}</fcub:CUSTNO>
        </fcub:Customer-IO>
      </fcub:FCUBS_BODY>
    </fcub:QUERYCUSTOMER_IOFS_REQ>
  </soapenv:Body>
</soapenv:Envelope>`.trim();

  const body = await soapCall(CBS_URL, 'QueryCustomer', envelope);
  const res  = body?.['QUERYCUSTOMER_IOFS_RES'];
  const stat = res?.FCUBS_HEADER?.MSGSTAT;
  if (stat !== 'SUCCESS') {
    const err = res?.FCUBS_BODY?.FCUBS_ERROR_RESP?.ERROR?.EDESC || 'CBS error';
    throw new Error(err);
  }
  return res.FCUBS_BODY?.['Customer-Full'];
}

async function queryCustomerByPhone(phone) {
  const envelope = `
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:fcub="http://fcubs.ofss.com/service/FCUBSCustomerService">
  <soapenv:Header/>
  <soapenv:Body>
    <fcub:QUERYCUSTOMER_IOFS_REQ>
      <fcub:FCUBS_HEADER>
        <soapenv:SOURCE>${CBS_SOURCE}</soapenv:SOURCE>
        <fcub:UBSCOMP>FCUBS</fcub:UBSCOMP>
        <fcub:USERID>${CBS_USER}</fcub:USERID>
        <fcub:BRANCH>${CBS_BRANCH}</fcub:BRANCH>
        <fcub:SERVICE>FCUBSCustomerService</fcub:SERVICE>
        <fcub:OPERATION>QueryCustomer</fcub:OPERATION>
      </fcub:FCUBS_HEADER>
      <fcub:FCUBS_BODY>
        <fcub:Customer-IO>
          <fcub:MOBNUM>${phone}</fcub:MOBNUM>
        </fcub:Customer-IO>
      </fcub:FCUBS_BODY>
    </fcub:QUERYCUSTOMER_IOFS_REQ>
  </soapenv:Body>
</soapenv:Envelope>`.trim();

  const body = await soapCall(CBS_URL, 'QueryCustomer', envelope);
  const res  = body?.['QUERYCUSTOMER_IOFS_RES'];
  const stat = res?.FCUBS_HEADER?.MSGSTAT;
  if (stat !== 'SUCCESS') {
    const err = res?.FCUBS_BODY?.FCUBS_ERROR_RESP?.ERROR?.EDESC || 'CBS error';
    throw new Error(err);
  }
  return res.FCUBS_BODY?.['Customer-Full'];
}

async function queryCustAcc(accountNo, branch) {
  // 1. Sanitize input and force max length to exactly 16 characters
  let cleanedAccount = String(accountNo).replace(/\s/g, '');
  if (cleanedAccount.length > 16) {
    cleanedAccount = cleanedAccount.substring(0, 16); 
  }

  // 2. Extract branch code dynamically from the first 3 characters 
  let brn = branch;
  if (!brn && cleanedAccount) {
    if (cleanedAccount.length >= 3) {
      brn = cleanedAccount.substring(0, 3);
    }
  }
  brn = brn || CBS_BRANCH;

  console.log(`[SOAP Debug] Querying account detail... Account: ${cleanedAccount} | Target Derived Branch: ${brn}`);

  // 3. Keep the exact format from your working XML sample
  const envelope = `
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
   xmlns:fcub="http://fcubs.ofss.com/service/FCUBSAccService">
   <soapenv:Header />
   <soapenv:Body>
      <fcub:QUERYCUSTACC_IOFS_REQ>
         <fcub:FCUBS_HEADER>
            <fcub:SOURCE>${CBS_SOURCE}</fcub:SOURCE>
            <fcub:UBSCOMP>FCUBS</fcub:UBSCOMP>
            <fcub:USERID>${CBS_USER}</fcub:USERID>
            <fcub:BRANCH>${brn}</fcub:BRANCH>
            <fcub:SERVICE>FCUBSAccService</fcub:SERVICE>
            <fcub:OPERATION>QueryCustAcc</fcub:OPERATION>
         </fcub:FCUBS_HEADER>
         <fcub:FCUBS_BODY>
            <fcub:Cust-Account-IO>
               <fcub:BRN>${brn}</fcub:BRN>
               <fcub:ACC>${cleanedAccount}</fcub:ACC>
            </fcub:Cust-Account-IO>
         </fcub:FCUBS_BODY>
      </fcub:QUERYCUSTACC_IOFS_REQ>
   </soapenv:Body>
</soapenv:Envelope>`.trim();

  try {
    const body = await soapCall(CBS_ACC_URL, 'QueryCustAcc', envelope);
    const res  = body?.['QUERYCUSTACC_IOFS_RES'];
    const stat = res?.FCUBS_HEADER?.MSGSTAT;
    
    if (stat !== 'SUCCESS') {
      const err = res?.FCUBS_BODY?.FCUBS_ERROR_RESP?.ERROR?.EDESC || 'CBS error';
      console.error(`[SOAP Response Error] Branch: ${brn} | Msg: ${err}`);
      throw new Error(err);
    }
    return res.FCUBS_BODY?.['Cust-Account-Full'];
  } catch (error) {
    console.error(`[SOAP Network/Execution Crash] Details:`, error.message);
    throw error;
  }
}
// async function queryCustAcc(accountNo, branch) {
//   // Extract branch code dynamically from the first 3 characters of the account number
//   let brn = branch;
//   if (!brn && accountNo) {
//     const cleanAcc = String(accountNo).replace(/\s/g, '');
//     if (cleanAcc.length >= 3) {
//       brn = cleanAcc.substring(0, 3);
//     }
//   }
//   brn = brn || CBS_BRANCH;

//   // Console log for troubleshooting parameters before the SOAP call is sent
//   console.log(`[SOAP Debug] Querying account detail... Account: ${accountNo} | Target Derived Branch: ${brn}`);

//   const envelope = `
// <soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
//   xmlns:fcub="http://fcubs.ofss.com/service/FCUBSAccService">
//   <soapenv:Header/>
//   <soapenv:Body>
//     <fcub:QUERYCUSTACC_IOFS_REQ>
//       <fcub:FCUBS_HEADER>
//         <fcub:SOURCE>${CBS_SOURCE}</fcub:SOURCE>
//         <fcub:UBSCOMP>FCUBS</fcub:UBSCOMP>
//         <fcub:USERID>${CBS_USER}</fcub:USERID>
//         <fcub:BRANCH>${brn}</fcub:BRANCH>
//         <fcub:SERVICE>FCUBSAccService</fcub:SERVICE>
//         <fcub:OPERATION>QueryCustAcc</fcub:OPERATION>
//       </fcub:FCUBS_HEADER>
//       <fcub:FCUBS_BODY>
//         <fcub:Cust-Account-IO>
//           <fcub:BRN>${brn}</fcub:BRN>
//           <fcub:ACC>${accountNo}</fcub:ACC>
//         </fcub:Cust-Account-IO>
//       </fcub:FCUBS_BODY>
//     </fcub:QUERYCUSTACC_IOFS_REQ>
//   </soapenv:Body>
// </soapenv:Envelope>`.trim();

//   try {
//     const body = await soapCall(CBS_ACC_URL, 'QueryCustAcc', envelope);
//     const res  = body?.['QUERYCUSTACC_IOFS_RES'];
//     const stat = res?.FCUBS_HEADER?.MSGSTAT;
    
//     if (stat !== 'SUCCESS') {
//       const err = res?.FCUBS_BODY?.FCUBS_ERROR_RESP?.ERROR?.EDESC || 'CBS error';
//       console.error(`[SOAP Response Error] Branch: ${brn} | Msg: ${err}`);
//       throw new Error(err);
//     }
//     return res.FCUBS_BODY?.['Cust-Account-Full'];
//   } catch (error) {
//     console.error(`[SOAP Network/Execution Crash] Details:`, error.message);
//     throw error;
//   }
// }

module.exports = { queryCustomer, queryCustomerByPhone, queryCustAcc };