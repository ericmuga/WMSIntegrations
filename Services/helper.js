export const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== '';
export const isValidDate = (value) => !isNaN(Date.parse(value));
export const isPositiveNumber = (value) => typeof value === 'number' && value > 0;

export const validateLine = (line) => {
  return isPositiveNumber(line.line_no) &&
         isNonEmptyString(line.item_no) &&
         isNonEmptyString(line.item_description) &&
         isPositiveNumber(line.order_qty) &&
         isPositiveNumber(line.qty_base);
};

export const validateOrder = (order) => {
  return isNonEmptyString(order.order_no) &&
         isNonEmptyString(order.ended_by) &&
         isNonEmptyString(order.customer_no) &&
         isNonEmptyString(order.customer_name) &&
         isValidDate(order.shp_date) &&
         order.lines.every(validateLine);
};