import util from '../src/util'

describe('util', () => {
  describe('findbox util funtcion', () => {
    test('should not find ctts box on url box', () => {
      const root = {
        type: "url ",
        // ...
      }
  
      const type = 'ctts'
      expect(util.findBox(root, type)).toBe(undefined)
    })
  
    test('should find esds box on mp4a box', () => {
      const esdsBox = {
        subBox:[/** */],
        type: "esds",
        // ...
      }
      const root = {
        // ...
        subBox: [esdsBox],
        type: "mp4a",
      }
  
      const type = 'esds'
      expect(util.findBox(root, type)).toEqual(esdsBox)
    })
  
    test('should find ESDescriptor on esds box', () => {
      const ESDescriptor = {EScode: ['11', '90'], type: 5}
      const root = {
        // ...
        subBox: [
          {
            type: 3,
            subBox: [
              {
                type: 4,
                subBox: [ESDescriptor],
              }
            ],
          }
        ],
        type: "mp4a",
      }
  
      const type = 5
      expect(util.findBox(root, type)).toEqual(ESDescriptor)
    })
  })
})
