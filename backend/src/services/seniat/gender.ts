const FEMENINO = new Set(
  `
maria mariana mariangela mariangel marisabel marisol maritza mariela
ana andrea angela angelica antonella aurora
beatriz belkis brigida
carla carolina carmen catalina cecilia celeste clara claudia constanza
daniela diana doris
edith elena elisa elizabeth elsa emily emma erika esther evelyn evelin
fatima flor florencia francisca
gabriela genesis geraldine gloria graciela
hilda
ines irene iris isabel isabella ivonne
jennifer jessica jimena johana josefina julia juliana
karina karla katia
laura leidy leslie liliana lisbeth liseth lucia luisa luz
magaly mercedes melissa mery michelle milagros miriam
nancy natalia nelly nilda noemi norma
olga
paola patricia paulina
raquel rebecca rebeca rosa rosario rosibel ruth
sandra sara silvia sofia sonia susana
tatiana teresa
valentina valeria vanessa veronica victoria virginia viviana
ximena
yajaira yamile yamilet yanet yelitza yenifer yesenia yolanda yulitza yuraima
zuleima zulay zuleyma
auxiliadora alicia alexandra andreina
hedimar hermaris krisimarlin leibys leanne leanny
meisberlyn yeikar
`.match(/[a-záéíóúñü]+/gi) ?? [],
);

const MASCULINO = new Set(
  `
aaron abraham adam adrian alberto alejandro alex alexander alfredo
alonso andres angel antonio armando arturo
benjamin bernardo brayan brian bryan
carlos cesar christian christopher cristian cristiano
daniel david diego douglas
edgar eduardo edwin elias eliezer emilio enrique erik ernesto esteban eugenio
fabio felipe felix fernando francisco franklin
gabriel gerardo gerson giovanni gustavo
hector herik hernan hugo
ignacio isaac ivan
jacobo jaime javier jesus joan jorge jose joseph juan julio
kevin
leonardo luis
manuel marco marcos mario martin mateo matias miguel
nelson nestor nicolas
omar orlando oscar
pablo pedro
rafael ramon raul ricardo robert roberto rodolfo rodrigo roger ruben
salvador samuel santiago sebastian sergio simon
tomas
vicente victor
william wilson
xavier
yonathan
`.match(/[a-záéíóúñü]+/gi) ?? [],
);

function normalizeToken(token: string): string {
  return String(token || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-zñ]/g, '');
}

export function inferGender(fullName: string): 'FEMENINO' | 'MASCULINO' | '' {
  if (!fullName) return '';

  const tokens = String(fullName)
    .replace(/^(?:V|E|J|G|P)\d+\s*/i, '')
    .split(/\s+/)
    .map(normalizeToken)
    .filter((t) => t.length > 1 && !['de', 'del', 'la', 'las', 'los', 'y'].includes(t));

  let female = 0;
  let male = 0;

  for (const token of tokens) {
    if (FEMENINO.has(token)) female += 2;
    if (MASCULINO.has(token)) male += 2;
    if (!FEMENINO.has(token) && !MASCULINO.has(token)) {
      if (/a$/.test(token)) female += 1;
      if (/o$/.test(token)) male += 1;
    }
  }

  for (const token of tokens) {
    if (['joshua', 'ismael', 'elias', 'matias', 'lucas', 'nicolas', 'tomas'].includes(token)) {
      male += 3;
      female -= 1;
    }
    if (['jose', 'jesus', 'andres'].includes(token)) male += 2;
  }

  if (female === male) return '';
  return female > male ? 'FEMENINO' : 'MASCULINO';
}
