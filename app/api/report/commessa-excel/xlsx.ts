type XlsxCellValue = string | number | boolean | null | undefined;

type XlsxSheet = {
  name: string;
  rows: XlsxCellValue[][];
};

const ZIP_LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY_HEADER_SIGNATURE = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;

const XLF_NS =
  "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

function encodeUtf8(value: string) {
  return new TextEncoder().encode(value);
}

function concatBytes(chunks: Uint8Array[]) {
  const totalLength = chunks.reduce(
    (somma, chunk) => somma + chunk.length,
    0
  );
  const bytes = new Uint8Array(totalLength);
  let offset = 0;

  chunks.forEach((chunk) => {
    bytes.set(chunk, offset);
    offset += chunk.length;
  });

  return bytes;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function getColumnName(indexZeroBased: number) {
  let index = indexZeroBased + 1;
  let name = "";

  while (index > 0) {
    const resto = (index - 1) % 26;
    name = String.fromCharCode(65 + resto) + name;
    index = Math.floor((index - 1) / 26);
  }

  return name;
}

function getDosDateTime(date: Date) {
  const year = Math.max(1980, date.getFullYear());
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);

  return {
    dosDate:
      ((year - 1980) << 9) |
      (month << 5) |
      day,
    dosTime:
      (hours << 11) |
      (minutes << 5) |
      seconds,
  };
}

function createCrc32Table() {
  const table = new Uint32Array(256);

  for (let i = 0; i < 256; i += 1) {
    let crc = i;

    for (let bit = 0; bit < 8; bit += 1) {
      crc =
        crc & 1
          ? 0xedb88320 ^ (crc >>> 1)
          : crc >>> 1;
    }

    table[i] = crc >>> 0;
  }

  return table;
}

const CRC32_TABLE = createCrc32Table();

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;

  for (let index = 0; index < bytes.length; index += 1) {
    crc =
      CRC32_TABLE[(crc ^ bytes[index]) & 0xff] ^
      (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16LE(
  target: Uint8Array,
  offset: number,
  value: number
) {
  const view = new DataView(
    target.buffer,
    target.byteOffset,
    target.byteLength
  );
  view.setUint16(offset, value, true);
}

function writeUint32LE(
  target: Uint8Array,
  offset: number,
  value: number
) {
  const view = new DataView(
    target.buffer,
    target.byteOffset,
    target.byteLength
  );
  view.setUint32(offset, value, true);
}

function buildZip(entries: {
  path: string;
  data: Uint8Array;
}[]) {
  const now = new Date();
  const { dosDate, dosTime } = getDosDateTime(now);
  const localChunks: Uint8Array[] = [];
  const centralChunks: Uint8Array[] = [];
  let localOffset = 0;

  entries.forEach((entry) => {
    const fileNameBytes = encodeUtf8(entry.path);
    const crc = crc32(entry.data);
    const localHeader = new Uint8Array(30);
    const centralHeader = new Uint8Array(46);

    writeUint32LE(
      localHeader,
      0,
      ZIP_LOCAL_FILE_HEADER_SIGNATURE
    );
    writeUint16LE(localHeader, 4, 20);
    writeUint16LE(localHeader, 6, 0);
    writeUint16LE(localHeader, 8, 0);
    writeUint16LE(localHeader, 10, dosTime);
    writeUint16LE(localHeader, 12, dosDate);
    writeUint32LE(localHeader, 14, crc);
    writeUint32LE(
      localHeader,
      18,
      entry.data.length
    );
    writeUint32LE(
      localHeader,
      22,
      entry.data.length
    );
    writeUint16LE(
      localHeader,
      26,
      fileNameBytes.length
    );
    writeUint16LE(localHeader, 28, 0);

    localChunks.push(localHeader, fileNameBytes, entry.data);

    writeUint32LE(
      centralHeader,
      0,
      ZIP_CENTRAL_DIRECTORY_HEADER_SIGNATURE
    );
    writeUint16LE(centralHeader, 4, 20);
    writeUint16LE(centralHeader, 6, 20);
    writeUint16LE(centralHeader, 8, 0);
    writeUint16LE(centralHeader, 10, 0);
    writeUint16LE(centralHeader, 12, dosTime);
    writeUint16LE(centralHeader, 14, dosDate);
    writeUint32LE(centralHeader, 16, crc);
    writeUint32LE(
      centralHeader,
      20,
      entry.data.length
    );
    writeUint32LE(
      centralHeader,
      24,
      entry.data.length
    );
    writeUint16LE(
      centralHeader,
      28,
      fileNameBytes.length
    );
    writeUint16LE(centralHeader, 30, 0);
    writeUint16LE(centralHeader, 32, 0);
    writeUint16LE(centralHeader, 34, 0);
    writeUint16LE(centralHeader, 36, 0);
    writeUint32LE(centralHeader, 38, 0);
    writeUint32LE(centralHeader, 42, localOffset);

    centralChunks.push(centralHeader, fileNameBytes);

    localOffset +=
      localHeader.length +
      fileNameBytes.length +
      entry.data.length;
  });

  const centralDirectory = concatBytes(centralChunks);
  const endOfCentralDirectory = new Uint8Array(22);
  const totalEntries = entries.length;

  writeUint32LE(
    endOfCentralDirectory,
    0,
    ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE
  );
  writeUint16LE(endOfCentralDirectory, 4, 0);
  writeUint16LE(endOfCentralDirectory, 6, 0);
  writeUint16LE(
    endOfCentralDirectory,
    8,
    totalEntries
  );
  writeUint16LE(
    endOfCentralDirectory,
    10,
    totalEntries
  );
  writeUint32LE(
    endOfCentralDirectory,
    12,
    centralDirectory.length
  );
  writeUint32LE(
    endOfCentralDirectory,
    16,
    localOffset
  );
  writeUint16LE(endOfCentralDirectory, 20, 0);

  return concatBytes([
    ...localChunks,
    centralDirectory,
    endOfCentralDirectory,
  ]);
}

function sanitizeSheetName(name: string) {
  return name.replace(/[\[\]\:\*\?\/\\]/g, " ").slice(0, 31);
}

function buildSheetXml(rows: XlsxCellValue[][]) {
  const rowXml = rows
    .map((row, rowIndex) => {
      const cellXml = row
        .map((cell, columnIndex) => {
          if (cell === null || typeof cell === "undefined") {
            return "";
          }

          const ref = `${getColumnName(columnIndex)}${rowIndex + 1}`;

          if (typeof cell === "number") {
            return `<c r="${ref}"><v>${Number.isFinite(cell) ? cell : 0}</v></c>`;
          }

          if (typeof cell === "boolean") {
            return `<c r="${ref}" t="b"><v>${cell ? 1 : 0}</v></c>`;
          }

          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell)}</t></is></c>`;
        })
        .join("");

      return `<row r="${rowIndex + 1}">${cellXml}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="${XLF_NS}"><sheetData>${rowXml}</sheetData></worksheet>`;
}

function buildWorkbookXml(sheets: XlsxSheet[]) {
  const sheetsXml = sheets
    .map(
      (sheet, index) =>
        `<sheet name="${escapeXml(sanitizeSheetName(sheet.name))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="${XLF_NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetsXml}</sheets></workbook>`;
}

function buildWorkbookRelsXml(sheets: XlsxSheet[]) {
  const rels = sheets
    .map(
      (_sheet, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
}

function buildRootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
}

function buildContentTypesXml(sheetCount: number) {
  const sheetOverrides = Array.from(
    { length: sheetCount },
    (_value, index) =>
      `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  ).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheetOverrides}</Types>`;
}

function buildAppXml(sheets: XlsxSheet[]) {
  const titles = sheets
    .map((sheet) => `<vt:lpstr>${escapeXml(sanitizeSheetName(sheet.name))}</vt:lpstr>`)
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Cantivo</Application><DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>${sheets.length}</vt:i4></vt:variant></vt:vector></HeadingPairs><TitlesOfParts><vt:vector size="${sheets.length}" baseType="lpstr">${titles}</vt:vector></TitlesOfParts><Company>A2C Sistemi</Company><LinksUpToDate>false</LinksUpToDate><SharedDoc>false</SharedDoc><HyperlinksChanged>false</HyperlinksChanged><AppVersion>16.0300</AppVersion></Properties>`;
}

function buildCoreXml() {
  const nowIso = new Date().toISOString();

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>A2C Sistemi</dc:creator><cp:lastModifiedBy>A2C Sistemi</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${nowIso}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${nowIso}</dcterms:modified></cp:coreProperties>`;
}

function buildStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/></styleSheet>`;
}

export function buildCommessaWorkbook(sheets: XlsxSheet[]) {
  return buildZip([
    {
      path: "[Content_Types].xml",
      data: encodeUtf8(buildContentTypesXml(sheets.length)),
    },
    {
      path: "_rels/.rels",
      data: encodeUtf8(buildRootRelsXml()),
    },
    {
      path: "docProps/app.xml",
      data: encodeUtf8(buildAppXml(sheets)),
    },
    {
      path: "docProps/core.xml",
      data: encodeUtf8(buildCoreXml()),
    },
    {
      path: "xl/workbook.xml",
      data: encodeUtf8(buildWorkbookXml(sheets)),
    },
    {
      path: "xl/_rels/workbook.xml.rels",
      data: encodeUtf8(buildWorkbookRelsXml(sheets)),
    },
    {
      path: "xl/styles.xml",
      data: encodeUtf8(buildStylesXml()),
    },
    ...sheets.map((sheet, index) => ({
      path: `xl/worksheets/sheet${index + 1}.xml`,
      data: encodeUtf8(buildSheetXml(sheet.rows)),
    })),
  ]);
}

