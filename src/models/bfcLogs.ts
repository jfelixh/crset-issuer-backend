export type BfcLogData = {
  validIdsSize: number;          
  invalidIdsSize: number;        
  serializedDataSize: number;    
  constructionTimeInSec: number; 
  publicationTimeInSec: number; 
  numberOfBlobs: number;        
  transactionHash: string;       
  blobVersionedHash: string[];   
  publicationTimeStemp: string;  
  transactionCost: number;      
  calldataTotalCost: number;    
  numberOfBfcLayers: number;    
  rHat: number;                 
}
