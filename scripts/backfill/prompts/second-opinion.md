You receive only a JSON array of objects with `id`, `quote` and `summary`. Independently classify each event from its quote and summary using these six definitions.


| Key | Label | Definition |
| --- | --- | --- |
| `funding` | Funding | A financing event such as an investment round, grant or debt financing. |
| `partnership` | Partnerships & contracts | A collaboration, partnership, contract or customer agreement. |
| `product` | Products & milestones | A product launch, release, technical milestone or demonstrated result. |
| `people` | People | An appointment, hire, departure or other personnel change. |
| `corporate` | Corporate | A corporate transaction or change such as an acquisition, merger, listing or closure. |
| `other` | Other | A dated event outside the other five definitions. |

Return only a JSON array of objects with `id` and `type`, exactly one per input ID. Use the type key from the table. Include no other fields or surrounding text.
