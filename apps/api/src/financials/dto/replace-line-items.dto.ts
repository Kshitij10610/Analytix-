import { Type } from 'class-transformer';
import { ValidateNested, ArrayMinSize } from 'class-validator';
import { CreateLineItemDto } from './create-line-item.dto';

export class ReplaceLineItemsDto {
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => CreateLineItemDto)
  lineItems!: CreateLineItemDto[];
}
