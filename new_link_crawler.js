// Variables

const tags = [
  "aatrox", "ahri", "akali", "alistar", "amumu", "anivia", "annie", "aphelios",
  "ashe", "aurelionsol", "azir", "bard", "blitzcrank", "brand", "braum", "caitlyn",
  "camille", "cassiopeia", "chogath", "corki", "darius", "diana", "drmundo", "draven",
  "ekko", "elise", "evelynn", "ezreal", "fiddlesticks", "fiora", "fizz", "galio",
  "gangplank", "garen", "gnar", "gragas", "graves", "hecarim", "heimerdinger", "illaoi",
  "irelia", "ivern", "janna", "jarvaniv", "jax", "jayce", "jhin", "jinx", "kaisa", "kalista",
  "karma", "karthus", "kassadin", "katarina", "kayle", "kayn", "kennen", "khazix", "kindred",
  "kled", "kogmaw", "leblanc", "leesin", "leona", "lillia", "lissandra", "lucian", "lulu", "lux",
  "malphite", "malzahar", "maokai", "masteryi", "missfortune", "mordekaiser", "morgana", "nami",
  "nasus", "nautilus", "neeko", "nidalee", "nocturne", "nunuwillump", "olaf", "orianna", "ornn",
  "pantheon", "poppy", "pyke", "qiyana", "quinn", "rakan", "rammus", "reksai", "rell", "renekton",
  "rengar", "riven", "rumble", "ryze", "samira", "sejuani", "senna", "seraphine", "sett", "shaco",
  "shen", "shyvana", "singed", "sion", "sivir", "skarner", "sona", "soraka", "swain", "sylas",
  "syndra", "tahmkench", "taliyah", "talon", "taric", "teemo", "thresh", "tristana", "trundle",
  "tryndamere", "twistedfate", "twitch", "udyr", "urgot", "varus", "vayne", "veigar", "velkoz",
  "vi", "viktor", "vladimir", "volibear", "warwick", "wukong", "xayah", "xerath", "xinzhao",
  "yasuo", "yone", "yorick", "yuumi", "zac", "zed", "ziggs", "zilean", "zoe", "zyra",
  "viego", "gwen", "akshan", "vex", "zeri", "renataglasc", "belveth", "nilah", "ksante",
  "milio", "naafiri", "briar", "hwei", "smolder", "kai'sa", "pentakill", "leagueoflegends"
];

const date_from = new Date("2024-08-01");
const date_to = new Date(); // current date
const step_in_millis = 0.5 * 24 * 60 * 60 * 1000;
const limit = 60; // currently max allowed
const max_offset = 1000; // currently max allowed

const displayDate = false;
const displayQuality = false;
const displayViews = false;
const minLengthInSeconds = 1;
const maxLengthInSeconds = 1000;



const https = require("https");
const fs = require("fs");
const { Queue } = require("async-await-queue");

main();

async function main() {
  var list = []
  for(let from = date_from.getTime(); from < date_to.getTime(); from += step_in_millis){
    let to = Math.min(from + step_in_millis, date_to.getTime());
    let sublist = await fetchDataFromAPI(timestamp_from=from, timestamp_to=to);
    list.push(...sublist);
  }

  // Filter by Tag
  console.log("Number of links total: " + list.length);
  list = list.filter(filterByDate);
  console.log("After filtered by date: " + list.length);
  list = [...new Set(list)];
  console.log("After removing duplicates: " + list.length);
  list = list.filter(filterByPrivacy);
  console.log("After filtering by privacy: " + list.length);
  list = list.filter(filterByVideoLength);
  console.log("After filtering by video length: " + list.length);

  // Sort by Quality, then by Date
  list.sort((a, b) => {
    if (a.sourceHeight !== b.sourceHeight) {
      return b.sourceHeight - a.sourceHeight;
    }
    return b.created - a.created;
  });

  let listsByTag = {};
  for(let tag of tags){
    listsByTag[tag] = [];
  }


  if (!fs.existsSync("links")) {
    fs.mkdirSync("links");
  }

  
  await fs.writeFileSync(`links/_all-links.txt`, "");
  await fs.writeFileSync(`links/_all-links-with-tags.txt`, "");
  await fs.writeFileSync(`links/_all-links-without-tags.txt`, "");
  let list_with_tags = [];
  for(let videoItem of list){
    for(let tag of tags){
      if(videoItem.tags.includes(tag)){
        listsByTag[tag].push(videoItem);
      }
    }
    await fs.appendFileSync(`links/_all-links.txt`, videoItem.contentUrl + "\n", "utf8");
  }


  for(let tag of tags){
    let filename = `links/${tag}-links.txt`;
    console.log(filename + ": " + listsByTag[tag].length + " links.")
    await fs.writeFileSync(filename, "");
    for(let videoItem of listsByTag[tag]){
      var line = videoItem.contentUrl;
      await fs.appendFileSync(filename, line + "\n", "utf8");
      await fs.appendFileSync(`links/_all-links-with-tags.txt`, line + "\n", "utf8");
      list_with_tags.push(videoItem);
    }
  }

  for(let videoItem of list){
    if(!list_with_tags.includes(videoItem)){
      await fs.appendFileSync(`links/_all-links-without-tags.txt`, videoItem.contentUrl + "\n", "utf8");
      console.log(videoItem.tags);
    }
    
  }



}


function filterByDate(videoItem) {
  return (date_from.getTime() <= videoItem.created && videoItem.created <= date_to.getTime()) 
}

function filterByPrivacy(videoItem) {
  return !videoItem.contentUrl.includes("privacy");
}

function filterByVideoLength(videoItem) {
  return (
    minLengthInSeconds <= videoItem.videoLengthSeconds && videoItem.videoLengthSeconds <= maxLengthInSeconds);
}

async function fetchDataFromAPI(timestamp_from, timestamp_to) {
  let current_max_offset = max_offset;
  let allObjects = {};
  const queue = new Queue(6, 100);
  let promises = [];

  for (let offset = 0; offset <= current_max_offset; offset += limit) {
    promises.push(
      (async () => {
        const me = Symbol();
        var list;
        var response;
        const dateFrom = new Date(timestamp_from).toLocaleDateString('en-US', {year: 'numeric', month: '2-digit', day: '2-digit'});;
        const dateTo = new Date(timestamp_to).toLocaleDateString('en-US', {year: 'numeric', month: '2-digit', day: '2-digit'});;
        await queue.wait(me, 0);
        try {
          if (offset < current_max_offset) {
            console.log(`Downloading for date range: ${dateFrom} to ${dateTo}, offset range: ${offset} to ${offset + limit}.`);
            response = await fetchData(
              `https://medal.tv/api/content?limit=${limit}&offset=${offset}&categoryId=bQnfO2HXP&sortBy=unagedScore&sortDirection=DESC&from=${timestamp_from}&to=${timestamp_to}`,
              {
                Cookie: "cookie-version=5; amp_68186c=202468706.MjI2MTA0Njgy..1hqla8jmn.1hqlasp4j.70.2k.9k; medal-auth=eyJyZWdpc3RlcmVkVXNlciI6dHJ1ZSwidXNlcklkIjoiMjI2MTA0NjgyIiwiaWQiOiIyMjYxMDQ2ODIiLCJrZXkiOiI2MTU5ZWRlNS04ZDMyLTQ4ZTQtYjU0OC1iM2NiNTQ2YWJkMjMiLCJhdXRoIjp7ImtleSI6IjYxNTllZGU1LThkMzItNDhlNC1iNTQ4LWIzY2I1NDZhYmQyMyIsInVzZXJJZCI6IjIyNjEwNDY4MiJ9fQ==; medal-auth-guest=false; amp_68186c_medal.tv=202468706.MjI2MTA0Njgy..1hqlaah39.1hqldo3oi.2n.f.36; downloadcta-state=hidden; usprivacy=1NNN; euconsent-v2=CP8i0cAP8i0cAAKA0AENDgCsAP_AAEPAACiQg1NX_H__bW9r8X7_aft0eY1P9_j77sQxBhfJE-4F3LvW_JwXx2E5NF36tqoKmRoEu3ZBIUNlHJHUTVmwaogVryHsakWcoTNKJ6BkkFMRM2dYCF5vm4tjeQKY5_p_d3fx2D-t_dv839zzz8VHn3e5fue0-PCdU5-9Dfn9fRfb-9IP9_78v8v8_l_rk2_eT13_pcvr_D--f_87_XW-9_cAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEQagCzDQuIAuyJCQm0DCKBACIKwgIoEAAAAJA0QEALgwKdgYBLrCRACBFAAcEAIQAUZAAgAAEgAQiACQIoEAAEAgEAAIAEAgEADAwADgAtBAIAAQHQMUwoAFAsIEiMiIUwIQoEggJbKBBKCoQVwgCLDAigERsFAAgCQEVgACAsXgMASAlYkECXUG0AABAAgFFKFQik_MAQ4Jmy1V4om0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAACAA.cAAAD_gAAAAA; addtl_consent=1~43.3.9.6.9.13.6.4.15.9.5.2.11.1.7.1.3.2.10.33.4.6.9.17.2.9.20.7.20.5.20.9.2.1.4.11.29.4.14.9.3.10.6.2.9.6.6.9.8.33.5.3.1.27.1.17.10.9.1.8.6.2.8.3.4.146.65.1.17.1.18.25.35.5.18.9.7.41.2.4.18.24.4.9.6.5.2.14.18.7.3.2.2.8.28.8.6.3.10.4.20.2.17.10.11.1.3.22.16.2.6.8.6.11.6.5.33.11.8.11.28.12.1.5.2.17.9.6.40.17.4.9.15.8.7.3.12.7.2.4.1.7.12.13.22.13.2.6.8.10.1.4.15.2.4.9.4.5.4.7.13.5.15.17.4.14.10.15.2.5.6.2.2.1.2.14.7.4.8.2.9.10.18.12.13.2.18.1.1.3.1.1.9.7.2.16.5.19.8.4.8.5.4.8.4.4.2.14.2.13.4.2.6.9.6.3.2.2.3.5.2.3.6.10.11.6.3.19.8.3.3.1.2.3.9.19.26.3.10.13.4.3.4.6.3.3.3.3.1.1.1.6.11.3.1.1.11.6.1.10.5.8.3.2.2.4.3.2.2.7.15.7.14.1.3.3.4.5.4.3.2.2.5.5.1.2.9.7.9.1.5.3.7.10.11.1.3.1.1.2.1.3.2.6.1.12.8.1.3.1.1.2.2.7.7.1.4.3.6.1.2.1.4.1.1.4.1.1.2.1.8.1.7.4.3.3.3.5.3.15.1.15.10.28.1.2.2.12.3.4.1.6.3.4.7.1.3.1.4.1.5.3.1.3.4.1.5.2.3.1.2.2.6.2.1.2.2.2.4.1.1.1.2.2.1.1.1.1.2.1.1.1.2.2.1.1.2.1.2.1.7.1.7.1.1.1.1.2.1.4.2.1.1.9.1.6.2.1.6.2.3.2.1.1.1.2.5.2.4.1.1.2.2.1.1.7.1.2.2.1.2.1.2.3.1.1.2.4.1.1.1.5.1.3.6.4.5.5.4.1.2.3.1.4.3.2.2.3.1.1.1.1.1.11.1.3.1.1.2.2.1.6.3.3.5.2.7.1.1.2.5.1.9.5.1.3.1.8.4.5.1.9.1.1.1.2.1.1.1.4.2.13.1.1.3.1.2.2.3.1.2.1.1.1.2.1.3.1.1.1.1.2.4.1.5.1.2.4.3.10.2.9.7.2.2.1.3.3.1.6.1.2.5.1.1.2.6.4.2.1.200.200.100.100.200.400.100.100.100.400.1700.100.204.596.100.1000.800.500.400.200.200.500.1300.801.99.506.95.1399.1100.4402.1798.1400.1300.200.100.800.900.300; __cf_bm=haBmRqedpuVMQr15fdzgimSrn_F.su8yXIqbRqmcORM-1712267170-1.0.1.1-yEX_5XBndJj32xhb1asBay7VhpXPfMLpKI.sJ.1suGMq.LHVwr4RXOKg2Yh9wChhE1HkX3VqVouyH8V26Nw7VQ",
              }
            );
            //console.log(`request: https://medal.tv/api/content?limit=${limit}&offset=${offset}&categoryId=bQnfO2HXP&sortBy=unagedScore&sortDirection=DESC&from=${timestamp_from}&to=${timestamp_to}`);
            //	 console.log("response: " + response);
            list = JSON.parse(response);
            console.log(`Finished downloading for date range: ${dateFrom} to ${dateTo}, offset range: ${offset} to ${offset + limit}: ${list.length} links.`);

            if (
              list === undefined ||
              list === null ||
              list.length === 0 ||
              list.length === undefined
            ) {
              current_max_offset = offset;
              list = [];
            }
            allObjects[offset] = list;
          }
        } catch (err) {
          console.error("Something went wrong: ", err.message);
        } finally {
          queue.end(me);
        }
      })()
    );
  }
  await Promise.allSettled(promises);
  return Object.values(allObjects).flat();
}

function fetchData(url, headers = {}) {
  const options = {
    headers: headers,
  };

  return new Promise((resolve, reject) => {
    https
      .get(url, options, (res) => {
        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          resolve(data);
        });
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}
