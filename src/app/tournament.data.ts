export type Team = { flag: string; name: string; confederation: string; seed: number };
export type Group = { code: string; teams: Team[] };

export const GROUPS: Group[] = [
  { code: 'A', teams: [['🇲🇽','Mexico','CONCACAF'],['🇿🇦','South Africa','CAF'],['🇰🇷','Korea Republic','AFC'],['🇨🇿','Czechia','UEFA']] },
  { code: 'B', teams: [['🇨🇦','Canada','CONCACAF'],['🇧🇦','Bosnia and Herzegovina','UEFA'],['🇶🇦','Qatar','AFC'],['🇨🇭','Switzerland','UEFA']] },
  { code: 'C', teams: [['🇧🇷','Brazil','CONMEBOL'],['🇲🇦','Morocco','CAF'],['🇭🇹','Haiti','CONCACAF'],['🏴','Scotland','UEFA']] },
  { code: 'D', teams: [['🇺🇸','United States','CONCACAF'],['🇵🇾','Paraguay','CONMEBOL'],['🇦🇺','Australia','AFC'],['🇹🇷','Türkiye','UEFA']] },
  { code: 'E', teams: [['🇩🇪','Germany','UEFA'],['🇨🇼','Curaçao','CONCACAF'],['🇨🇮','Côte d’Ivoire','CAF'],['🇪🇨','Ecuador','CONMEBOL']] },
  { code: 'F', teams: [['🇳🇱','Netherlands','UEFA'],['🇯🇵','Japan','AFC'],['🇸🇪','Sweden','UEFA'],['🇹🇳','Tunisia','CAF']] },
  { code: 'G', teams: [['🇧🇪','Belgium','UEFA'],['🇪🇬','Egypt','CAF'],['🇮🇷','IR Iran','AFC'],['🇳🇿','New Zealand','OFC']] },
  { code: 'H', teams: [['🇪🇸','Spain','UEFA'],['🇨🇻','Cabo Verde','CAF'],['🇸🇦','Saudi Arabia','AFC'],['🇺🇾','Uruguay','CONMEBOL']] },
  { code: 'I', teams: [['🇫🇷','France','UEFA'],['🇸🇳','Senegal','CAF'],['🇮🇶','Iraq','AFC'],['🇳🇴','Norway','UEFA']] },
  { code: 'J', teams: [['🇦🇷','Argentina','CONMEBOL'],['🇩🇿','Algeria','CAF'],['🇦🇹','Austria','UEFA'],['🇯🇴','Jordan','AFC']] },
  { code: 'K', teams: [['🇵🇹','Portugal','UEFA'],['🇨🇩','Congo DR','CAF'],['🇺🇿','Uzbekistan','AFC'],['🇨🇴','Colombia','CONMEBOL']] },
  { code: 'L', teams: [['🏴','England','UEFA'],['🇭🇷','Croatia','UEFA'],['🇬🇭','Ghana','CAF'],['🇵🇦','Panama','CONCACAF']] }
].map(group => ({ ...group, teams: group.teams.map((team, index) => ({ flag: team[0], name: team[1], confederation: team[2], seed: index + 1 })) }));
