/**
 * CBS SOAP Client — Oracle FLEXCUBE (FCUBS)
 * Builds raw SOAP envelopes and posts via axios (avoids wsdl dependency).
 */
const axios  = require('axios');
const xml2js = require('xml2js');

const CBS_URL    = process.env.CBS_SOAP_URL    || 'http://localhost:8080/FCUBSCustomerService';
const CBS_ACC_URL= process.env.CBS_ACC_SOAP_URL|| 'http://localhost:8080/FCUBSAccService';
const CBS_SOURCE = process.env.CBS_SOURCE      || 'ADC';
const CBS_USER   = process.env.CBS_USER        || 'ADCUSER';
const CBS_BRANCH = process.env.CBS_BRANCH      || '001';

// ── Generic SOAP call ─────────────────────────────────────────────────────────
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
  // Navigate to S:Body or soapenv:Body
  const body = result?.['S:Envelope']?.['S:Body']
    || result?.['soapenv:Envelope']?.['soapenv:Body']
    || {};
  return body;
}

// ── QueryCustomer ─────────────────────────────────────────────────────────────
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

// ── QueryCustomerByPhone ───────────────────────────────────────────────────────
async function queryCustomerByPhone(phone) {
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

// ── QueryCustAcc ──────────────────────────────────────────────────────────────
async function queryCustAcc(accountNo, branch) {
  const brn = branch || CBS_BRANCH;
  const envelope = `
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:fcub="http://fcubs.ofss.com/service/FCUBSAccService">
  <soapenv:Header/>
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
          <fcub:ACC>${accountNo}</fcub:ACC>
        </fcub:Cust-Account-IO>
      </fcub:FCUBS_BODY>
    </fcub:QUERYCUSTACC_IOFS_REQ>
  </soapenv:Body>
</soapenv:Envelope>`.trim();

  const body = await soapCall(CBS_ACC_URL, 'QueryCustAcc', envelope);
  const res  = body?.['QUERYCUSTACC_IOFS_RES'];
  const stat = res?.FCUBS_HEADER?.MSGSTAT;
  if (stat !== 'SUCCESS') {
    const err = res?.FCUBS_BODY?.FCUBS_ERROR_RESP?.ERROR?.EDESC || 'CBS error';
    throw new Error(err);
  }
  return res.FCUBS_BODY?.['Cust-Account-Full'];
}

module.exports = { queryCustomer, queryCustomerByPhone, queryCustAcc };
